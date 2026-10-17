import io
import json
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

import fitz
import httpx
from docx import Document
from fastapi.testclient import TestClient
from PIL import Image
from pptx import Presentation

from app import ai, db
from app.main import app

REAL_ASYNC_CLIENT = httpx.AsyncClient


class WorkbenchTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path_patch = patch.object(db, "DATA", Path(self.temp.name))
        self.path_patch.start()
        ai.API_KEY = ""
        self.client = TestClient(app)
        self.client.__enter__()
        self.response = None
        self.completion_body = None
        self.status = 200
        self.captured = []
        self.transport = httpx.MockTransport(self.upstream)
        self.http_patch = patch("app.ai.httpx.AsyncClient", side_effect=lambda **kwargs: REAL_ASYNC_CLIENT(transport=self.transport, **kwargs))
        self.http_patch.start()
        self.client.put("/api/settings", json={"base_url":"https://example.com/v1", "model":"test-model", "api_key":"test-only-key"})
        result = self.upload("实验.txt", "酶活性受温度和 pH 影响。实验目的：观察温度对酶活性的影响。实验原理：酶催化反应。仪器与试剂：试管与淀粉酶。实验步骤：设置温度梯度，保持其他条件一致。注意事项：使用对照组。".encode())
        self.material = result.json()["id"]
        self.ref = {"material_id":self.material,"unit":"段落 1"}

    def tearDown(self):
        self.client.__exit__(None, None, None)
        self.http_patch.stop()
        self.path_patch.stop()
        ai.API_KEY = ""
        self.temp.cleanup()

    def upstream(self, request):
        self.captured.append((request.url, request.headers, json.loads(request.content)))
        if self.completion_body is not None:
            return httpx.Response(self.status, json=self.completion_body)
        return httpx.Response(self.status, json={"choices":[{"finish_reason":"stop", "message":{"content":self.response if isinstance(self.response,str) else json.dumps(self.response,ensure_ascii=False)}}]})

    def upload(self, name, data, kind="course", course="biochemistry"):
        return self.client.post("/api/materials", data={"course":course,"kind":kind}, files={"file":(name,data)})

    def question(self, answer=0):
        return {"stem":"设计温度实验时，哪些条件应保持一致？", "options":["其他条件","只改变 pH","所有条件同时变化","不设置对照"], "answer":answer,
                "explanation":"保持其他条件一致，才能比较温度的作用。", "topic":"实验对照", "sources":[self.ref.copy()]}

    def request(self, extra=None):
        return {"course":"biochemistry", "material_ids":[self.material], **(extra or {})}

    def create_quiz(self):
        self.response = {"questions":[self.question(),self.question()]}
        result = self.client.post("/api/study/quiz",json=self.request({"count":2}))
        self.assertEqual(result.status_code,200,result.text)
        return result.json()

    def report_response(self):
        return {"title":"酶活性实验", "sections":[{"key":key,"title":title,"content":f"固定内容：{title}","sources":[self.ref.copy()]} for key,title in [
            ("purpose","实验目的"),("principle","实验原理"),("equipment","仪器与试剂"),("steps","实验步骤"),("precautions","注意事项")]], "pre_questions":[self.question() for _ in range(3)]}

    def test_health_and_frontend(self):
        self.assertEqual(self.client.get("/api/health").json()["status"],"ok")
        response = self.client.get("/")
        self.assertEqual(response.status_code,200)
        self.assertIn("小家伙的小家伙",response.text)
        self.assertIn("frame-ancestors 'none'",response.headers["content-security-policy"])
        self.assertEqual(len(self.client.get("/api/courses").json()),4)

    def test_key_is_not_persisted_or_returned(self):
        settings = self.client.get("/api/settings").json()
        self.assertTrue(settings["key_present"])
        self.assertNotIn("api_key",settings)
        with db.connect() as con:
            saved = con.execute("SELECT data FROM settings").fetchone()[0]
        self.assertNotIn("test-only-key",saved)
        ai.API_KEY = ""
        self.assertFalse(self.client.get("/api/settings").json()["key_present"])
        self.assertEqual(self.client.post("/api/settings/test").status_code,428)

    def test_guide_documents_and_seekable_demo(self):
        html=self.client.get('/guide/使用说明书.html')
        self.assertEqual(html.status_code,200)
        self.assertIn('医学生零基础使用说明书',html.text)
        self.assertIn('script-src',html.headers['content-security-policy'])
        self.assertNotIn('onclick=',html.text)
        self.assertEqual(self.client.get('/guide/guide.js').status_code,200)
        pdf=self.client.get('/guide/使用说明书.pdf')
        self.assertEqual(pdf.status_code,200)
        self.assertTrue(pdf.content.startswith(b'%PDF'))
        clip=self.client.get('/guide/media/小家伙的小家伙-操作演示.mp4',headers={'Range':'bytes=0-31'})
        self.assertEqual(clip.status_code,206)
        self.assertEqual(len(clip.content),32)
        self.assertIn('video/mp4',clip.headers['content-type'])
        self.assertTrue(clip.headers['content-range'].startswith('bytes 0-31/'))

    def test_api_request_contract_and_test_connection(self):
        self.response = "OK"
        result = self.client.post("/api/settings/test")
        self.assertEqual(result.status_code,200)
        self.assertTrue(result.json()["generation_verified"])
        url,headers,body = self.captured[-1]
        self.assertEqual(str(url),"https://example.com/v1/chat/completions")
        self.assertEqual(headers["authorization"],"Bearer test-only-key")
        self.assertEqual(body["model"],"test-model")
        self.assertEqual(body["messages"], [{"role":"user", "content":"Reply with OK only."}])
        self.assertEqual(body["max_tokens"],128)

    def test_connection_distinguishes_truncation_from_generation(self):
        for content in [None, "", "O"]:
            with self.subTest(content=content):
                self.completion_body = {"choices":[{"finish_reason":"length", "message":{
                    "content":content, "reasoning_content":"private reasoning must not be returned"}}]}
                result = self.client.post("/api/settings/test")
                self.assertEqual(result.status_code,200,result.text)
                self.assertTrue(result.json()["ok"])
                self.assertFalse(result.json()["generation_verified"])
                self.assertIn("尚未验证完整内容生成",result.json()["message"])
                self.assertNotIn("private reasoning",result.text)
                self.assertNotIn("test-only-key",result.text)

    def test_truncated_generation_is_rejected_without_saving(self):
        self.completion_body = {"choices":[{"finish_reason":"length", "message":{"content":"{\"summary\":\"unfinished"}}]}
        result = self.client.post("/api/study/outline",json=self.request())
        self.assertEqual(result.status_code,502)
        self.assertIn("截断",result.json()["detail"])
        with db.connect() as con:
            self.assertEqual(con.execute("SELECT COUNT(*) FROM artifacts").fetchone()[0],0)
        self.assertEqual(self.captured[-1][2]["max_tokens"],5000)

    def test_connection_rejects_malformed_or_empty_responses(self):
        for body in [[], {}, {"choices":[]}, {"choices":[None]}, {"choices":[{"message":[]}]},
                     {"choices":[{"finish_reason":"length","message":{}}]},
                     {"choices":[{"finish_reason":"stop","message":{"content":""}}]},
                     {"choices":[{"finish_reason":"stop","message":{"content":None,"reasoning_content":"thinking only"}}]}]:
            with self.subTest(body=body):
                self.completion_body = body
                self.assertEqual(self.client.post("/api/settings/test").status_code,502)

    def test_invalid_api_addresses_and_clear_key(self):
        for base in ["http://example.com/v1", "https://user:password@example.com/v1", "https://example.com/v1/chat/completions", "https://example.com:invalid/v1", "https://[invalid/v1"]:
            response=self.client.put("/api/settings",json={"base_url":base,"model":"test"})
            self.assertEqual(response.status_code,400)
        self.assertEqual(self.client.put("/api/settings",json={"base_url":"http://127.0.0.1:11434/v1","model":"local","clear_key":True}).status_code,200)
        self.assertFalse(ai.API_KEY)

    def test_upstream_errors_are_redacted(self):
        self.response="should not be shown"
        for status in [401,403,404,429]:
            with self.subTest(status=status):
                self.status=status
                result=self.client.post("/api/settings/test")
                self.assertEqual(result.status_code,502)
                self.assertNotIn("should not be shown",result.text)
                self.assertNotIn("test-only-key",result.text)

    def test_reject_cross_origin_and_untrusted_host(self):
        response=self.client.post("/api/settings/test",headers={"Origin":"https://evil.example"})
        self.assertEqual(response.status_code,403)
        self.assertEqual(self.client.get("/api/health",headers={"Host":"evil.example"}).status_code,400)

    def test_pdf_and_scanned_pdf(self):
        document=fitz.open();page=document.new_page();page.insert_text((72,72),"Temperature controls enzyme activity.")
        result=self.upload("lecture.pdf",document.tobytes())
        self.assertEqual(result.status_code,200,result.text)
        details=self.client.get('/api/materials/'+result.json()['id']).json()
        self.assertEqual(details['chunks'][0]['unit'],'第 1 页')
        document=fitz.open();document.new_page()
        self.assertEqual(self.upload("scan.pdf",document.tobytes()).status_code,400)

    def test_pptx_text_and_notes(self):
        ppt=Presentation();slide=ppt.slides.add_slide(ppt.slide_layouts[1]);slide.shapes.title.text="Cell injury"
        slide.placeholders[1].text="Necrosis and apoptosis"
        slide.notes_slide.notes_text_frame.text="Teaching notes"
        buffer=io.BytesIO();ppt.save(buffer)
        response=self.upload("lecture.pptx",buffer.getvalue(),course="pathology")
        self.assertEqual(response.status_code,200,response.text)
        chunks=self.client.get('/api/materials/'+response.json()['id']).json()['chunks']
        self.assertEqual(chunks[0]['unit'],'第 1 张幻灯片')
        self.assertIn('Teaching notes',chunks[0]['text'])

    def test_docx_and_gb_text(self):
        doc=Document();doc.add_paragraph('实验目的');table=doc.add_table(rows=1,cols=2);table.cell(0,0).text='试剂';table.cell(0,1).text='酶'
        buffer=io.BytesIO();doc.save(buffer)
        response=self.upload('experiment.docx',buffer.getvalue(),kind='experiment')
        self.assertEqual(response.status_code,200,response.text)
        chunks=self.client.get('/api/materials/'+response.json()['id']).json()['chunks']
        self.assertEqual(chunks[-1]['unit'],'表 1')
        self.assertIn('酶',chunks[-1]['text'])
        response=self.upload('old.txt','酶活性'.encode('gb18030'))
        self.assertEqual(response.status_code,200,response.text)

    def test_invalid_uploads_leave_no_orphans(self):
        before=list((db.DATA/'uploads').iterdir())
        for name,data in [('bad.docx',b'not a zip'),('empty.txt',b''),('old.ppt',b'no')]:
            self.assertEqual(self.upload(name,data).status_code,400)
        self.assertEqual(before,list((db.DATA/'uploads').iterdir()))

    def test_course_isolation_and_template_not_evidence(self):
        response=self.client.post('/api/study/outline',json={'course':'pathology','material_ids':[self.material]})
        self.assertEqual(response.status_code,400)
        template=self.upload('template.txt','实验目的\n实验结果'.encode(),kind='template').json()['id']
        response=self.client.post('/api/study/outline',json=self.request({'material_ids':[template]}))
        self.assertEqual(response.status_code,400)
        self.assertFalse(self.captured)

    def test_outline_citations_and_idempotent_recall(self):
        self.response={'summary':'酶活性实验','items':[{'term':'温度','explanation':'酶活性受温度影响','importance':'核心','recall_question':'实验为何保持其他条件一致？','sources':[self.ref.copy()]}], 'connections':[{'chain':'温度 → 酶活性','explanation':'本实验比较温度的作用','sources':[self.ref.copy()]}]}
        result=self.client.post('/api/study/outline',json=self.request())
        self.assertEqual(result.status_code,200,result.text)
        data=result.json();self.assertEqual(data['data']['items'][0]['sources'][0]['title'],'实验.txt')
        self.assertEqual(self.client.post('/api/artifacts/'+data['id']+'/recall').json()['added'],1)
        self.assertEqual(self.client.post('/api/artifacts/'+data['id']+'/recall').json()['added'],0)
        self.assertEqual(len(self.client.get('/api/reviews?course=biochemistry').json()),1)
        self.assertIn('上传材料和学生陈述',self.captured[-1][2]['messages'][0]['content'])

    def test_false_citation_is_rejected_before_saving(self):
        self.response={'answer':'错误引用','follow_up':'','sources':[{'material_id':self.material,'unit':'第 99 页'}]}
        response=self.client.post('/api/study/chat',json=self.request({'message':'解释酶活性'}))
        self.assertEqual(response.status_code,502)
        self.assertEqual(self.client.get('/api/artifacts?course=biochemistry').json(),[])

    def test_malformed_model_output_is_rejected(self):
        self.response='not JSON'
        response=self.client.post('/api/study/outline',json=self.request())
        self.assertEqual(response.status_code,502)
        self.assertEqual(self.client.get('/api/artifacts?course=biochemistry').json(),[])

    def test_teach_and_chat_history(self):
        self.response={'understood':['提到了温度'],'corrections':[{'student_claim':'所有条件同时变化','feedback':'其他条件应一致','sources':[self.ref.copy()]}],'missing':[],'next_question':'为什么需要对照组？'}
        response=self.client.post('/api/study/feedback',json=self.request({'topic':'实验设计','explanation':'所有条件都同时变化。'}))
        self.assertEqual(response.status_code,200,response.text)
        self.response={'answer':'保持其他条件一致','follow_up':'你会如何设置对照？','sources':[self.ref.copy()]}
        response=self.client.post('/api/study/chat',json=self.request({'message':'为什么？','history':[{'role':'user','content':'对照组是什么？'}]}))
        self.assertEqual(response.status_code,200,response.text)
        self.assertEqual(response.json()['data']['question'],'为什么？')
        self.assertIn('对照组是什么',self.captured[-1][2]['messages'][1]['content'])

    def test_quiz_answers_hidden_grade_and_review(self):
        quiz=self.create_quiz()
        self.assertNotIn('answer',quiz['data']['questions'][0])
        self.assertNotIn('explanation',self.client.get('/api/artifacts/'+quiz['id']).json()['data']['questions'][0])
        invalid=self.client.post('/api/artifacts/'+quiz['id']+'/grade',json={'answers':[0,None]})
        self.assertEqual(invalid.status_code,400)
        grade=self.client.post('/api/artifacts/'+quiz['id']+'/grade',json={'answers':[0,2]}).json()
        self.assertEqual(grade['correct'],1);self.assertEqual(grade['total'],2)
        cards=self.client.get('/api/reviews?course=biochemistry').json();self.assertEqual(len(cards),1)
        self.assertNotIn('answer',cards[0])
        card=cards[0]['id']
        self.assertEqual(self.client.post('/api/reviews/'+card+'/answer',json={'answer':''}).status_code,400)
        revealed=self.client.post('/api/reviews/'+card+'/answer',json={'answer':'其他条件'}).json()
        self.assertEqual(revealed['answer'],'其他条件')
        result=self.client.post('/api/reviews/'+card+'/answer',json={'answer':'其他条件','remembered':True}).json()
        due=datetime.fromisoformat(result['due'])
        self.assertAlmostEqual((due-datetime.now(timezone.utc)).total_seconds()/86400,1,places=2)
        self.assertEqual(self.client.get('/api/reviews?course=biochemistry').json(),[])

    def test_quiz_wrong_number_rejected(self):
        self.response={'questions':[self.question()]}
        self.assertEqual(self.client.post('/api/study/quiz',json=self.request({'count':2})).status_code,502)

    def test_comparison_practice(self):
        self.response={'left_name':'A','right_name':'B','rows':[{'dimension':'作用','left':'A作用','right':'B作用','sources':[self.ref.copy()]},{'dimension':'条件','left':'A条件','right':'B条件','sources':[self.ref.copy()]}],'memory_tip':'按条件区分','practice':[self.question()]}
        response=self.client.post('/api/study/compare',json=self.request({'left':'A','right':'B'}))
        self.assertEqual(response.status_code,200,response.text)
        data=response.json();self.assertNotIn('answer',data['data']['practice'][0])
        response=self.client.post('/api/artifacts/'+data['id']+'/grade',json={'answers':[0]})
        self.assertEqual(response.json()['correct'],1)

    def test_report_template_export_and_linked_quiz(self):
        doc=Document();p=doc.add_paragraph();p.add_run('{{实验');p.add_run('名称}}')
        table=doc.add_table(rows=2,cols=1);table.cell(0,0).text='{{实验目的}}';table.cell(1,0).text='{{实验数据}}'
        buffer=io.BytesIO();doc.save(buffer)
        template=self.upload('school.docx',buffer.getvalue(),kind='template').json()['id']
        self.response=self.report_response()
        response=self.client.post('/api/reports',json=self.request({'title':'酶活性实验','template_id':template}))
        self.assertEqual(response.status_code,200,response.text)
        data=response.json()['data'];export=self.client.get('/api/exports/'+data['export_id'])
        self.assertEqual(export.status_code,200)
        rendered=Document(io.BytesIO(export.content))
        self.assertEqual(rendered.paragraphs[0].text,'酶活性实验')
        self.assertEqual(rendered.tables[0].cell(0,0).text,'固定内容：实验目的')
        self.assertIn('真实实验数据',rendered.tables[0].cell(1,0).text)
        all_text='\n'.join(p.text for p in rendered.paragraphs)
        self.assertIn('根据真实结果填写结论',all_text)
        self.assertIn('实验.txt',all_text)
        quiz=self.client.get('/api/artifacts/'+data['quiz_id']).json()
        self.assertEqual(len(quiz['data']['questions']),3)
        self.assertNotIn('answer',quiz['data']['questions'][0])

    def test_report_rejects_duplicate_fixed_sections(self):
        self.response=self.report_response();self.response['sections'][0]['key']='steps'
        response=self.client.post('/api/reports',json=self.request({'title':'实验'}))
        self.assertEqual(response.status_code,502)
        self.assertEqual(list((db.DATA/'exports').iterdir()),[])

    def test_headings_template_removes_example_conclusions(self):
        doc=Document();doc.add_paragraph('姓名：____');doc.add_heading('一、实验目的',1);doc.add_paragraph('旧目的');doc.add_heading('实验结论',1);doc.add_paragraph('样例结论：全部成功')
        buffer=io.BytesIO();doc.save(buffer)
        template=self.upload('school.docx',buffer.getvalue(),kind='template').json()['id']
        self.response=self.report_response()
        data=self.client.post('/api/reports',json=self.request({'title':'实验','template_id':template})).json()['data']
        rendered=Document(io.BytesIO(self.client.get('/api/exports/'+data['export_id']).content))
        text='\n'.join(p.text for p in rendered.paragraphs)
        self.assertNotIn('全部成功',text);self.assertNotIn('旧目的',text)
        self.assertIn('姓名：____',text);self.assertIn('固定内容：实验目的',text)

    def test_figure_labels_hidden_grade_aliases_and_review_cue(self):
        image=Image.new('RGB',(200,100),'white');buffer=io.BytesIO();image.save(buffer,'PNG')
        response=self.client.post('/api/figures',data={'course':'cell-biology'},files={'file':('cell.png',buffer.getvalue())})
        id=response.json()['id']
        self.assertEqual(self.client.get('/api/figures/'+id+'/practice').status_code,400)
        labels=[{'id':'p1','name':'细胞核 / nucleus','x':0.5,'y':0.5,'explanation':'根据教材标注核的位置。'},{'id':'p2','name':'细胞膜','x':0.8,'y':0.2,'explanation':'根据教材标注细胞边界。'}]
        response=self.client.put('/api/figures/'+id+'/labels',json={'labels':labels,'confirmed':True})
        self.assertEqual(response.status_code,200)
        practice=self.client.get('/api/figures/'+id+'/practice').json()
        self.assertNotIn('name',practice['points'][0])
        self.assertNotIn('explanation',practice['points'][0])
        grade=self.client.post('/api/figures/'+id+'/grade',json={'answers':{'p1':'Nucleus','p2':'错误'}}).json()
        self.assertEqual(grade['correct'],1)
        cards=self.client.get('/api/reviews?course=cell-biology').json()
        self.assertEqual(cards[0]['figure']['x'],0.8)
        self.assertNotIn('answer',cards[0])

    def test_deleting_material_preserves_artifacts(self):
        quiz=self.create_quiz()
        self.assertEqual(self.client.delete('/api/materials/'+self.material).status_code,200)
        self.assertEqual(self.client.get('/api/materials/'+self.material).status_code,404)
        self.assertEqual(self.client.get('/api/artifacts/'+quiz['id']).status_code,200)
        self.assertEqual(list((db.DATA/'uploads').iterdir()),[])


if __name__=='__main__':
    unittest.main()
