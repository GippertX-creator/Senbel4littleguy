from typing import Literal

from pydantic import BaseModel, Field, field_validator


class Source(BaseModel):
    material_id: str
    unit: str


class Cited(BaseModel):
    sources: list[Source] = Field(min_length=1)


class Knowledge(Cited):
    term: str
    explanation: str
    importance: Literal["核心", "拓展"]
    recall_question: str


class Connection(Cited):
    chain: str
    explanation: str


class Outline(BaseModel):
    summary: str
    items: list[Knowledge] = Field(min_length=1, max_length=16)
    connections: list[Connection] = Field(max_length=8)


class Answer(Cited):
    answer: str
    follow_up: str


class Correction(Cited):
    student_claim: str
    feedback: str


class Feedback(BaseModel):
    understood: list[str]
    corrections: list[Correction]
    missing: list[Correction]
    next_question: str


class Question(Cited):
    stem: str
    options: list[str] = Field(min_length=4, max_length=4)
    answer: int = Field(ge=0, le=3)
    explanation: str
    topic: str


class Quiz(BaseModel):
    questions: list[Question] = Field(min_length=1, max_length=10)


class CompareRow(Cited):
    dimension: str
    left: str
    right: str


class Comparison(BaseModel):
    left_name: str
    right_name: str
    rows: list[CompareRow] = Field(min_length=2, max_length=8)
    memory_tip: str
    practice: list[Question] = Field(min_length=1, max_length=4)


class ReportSection(Cited):
    key: Literal["purpose", "principle", "equipment", "steps", "precautions"]
    title: str
    content: str


class ReportRecord(Cited):
    title: str = Field(min_length=1, max_length=150)
    subject_label: str = Field(default="观察对象 / 实验分组", max_length=80)
    subjects: list[str] = Field(min_length=1, max_length=20)
    fields: list[str] = Field(min_length=1, max_length=8)
    note: str = Field(default="", max_length=1000)


class ReportFigure(Cited):
    title: str = Field(min_length=1, max_length=150)
    instruction: str = Field(min_length=1, max_length=1500)
    caption: str = Field(min_length=1, max_length=500)
    fields: list[str] = Field(min_length=1, max_length=8)


class ReportProse(Cited):
    title: str = Field(min_length=1, max_length=150)
    content: str = Field(min_length=1, max_length=6000)


class Report(BaseModel):
    title: str
    sections: list[ReportSection] = Field(min_length=5, max_length=5)
    records: list[ReportRecord] = Field(min_length=1, max_length=10)
    figures: list[ReportFigure] = Field(min_length=1, max_length=12)
    analysis: list[ReportProse] = Field(min_length=1, max_length=10)
    discussion: list[ReportProse] = Field(min_length=1, max_length=10)
    conclusion: ReportProse
    pre_questions: list[Question] = Field(min_length=2, max_length=4)

    @field_validator('conclusion')
    @classmethod
    def conclusion_needs_actual_result(cls,value):
        if '【填写：' not in value.content:
            raise ValueError('结论须保留本次实际结果的明确填写位置')
        return value


class MaterialScope(BaseModel):
    material_id: str = Field(min_length=1, max_length=100)
    chapter_id: str = Field(default="", max_length=40)
    start_unit: str = Field(default="", max_length=150)
    end_unit: str = Field(default="", max_length=150)


class StudyRequest(BaseModel):
    course: str
    material_ids: list[str] = Field(default_factory=list, max_length=50)
    topic: str = Field(default="", max_length=1000)
    scopes: list[MaterialScope] = Field(default_factory=list, max_length=30)
    instructions: str = Field(default="", max_length=2000)


class ChatRequest(StudyRequest):
    message: str = Field(min_length=1, max_length=6000)
    history: list[dict[str, str]] = Field(default_factory=list, max_length=12)


class FeedbackRequest(StudyRequest):
    explanation: str = Field(min_length=5, max_length=6000)


class QuizRequest(StudyRequest):
    count: int = Field(default=5, ge=1, le=10)
    mode: Literal["章节小测", "易混辨别"] = "章节小测"


class CompareRequest(StudyRequest):
    left: str = Field(min_length=1, max_length=80)
    right: str = Field(min_length=1, max_length=80)


class ReportDetails(BaseModel):
    course_name: str = Field(default="", max_length=100)
    name: str = Field(default="", max_length=100)
    student_id: str = Field(default="", max_length=100)
    college: str = Field(default="", max_length=100)
    department: str = Field(default="", max_length=100)
    major: str = Field(default="", max_length=100)
    instructor: str = Field(default="", max_length=100)
    group: str = Field(default="", max_length=200)
    location: str = Field(default="", max_length=100)
    date: str = Field(default="", max_length=100)
    experiment_type: str = Field(default="", max_length=100)


class ReportRequest(StudyRequest):
    title: str = Field(min_length=1, max_length=100)
    template_id: str | None = None
    details: ReportDetails = Field(default_factory=ReportDetails)


class AgentTask(BaseModel):
    action: Literal["outline", "chat", "quiz", "compare", "report", "feedback"]
    topic: str = Field(default="", max_length=1000)
    material_key: str = Field(default="", max_length=20)
    chapter_key: str = Field(default="", max_length=40)
    scope_mode: Literal["inherit", "all"] = "inherit"
    start_unit: str = Field(default="", max_length=150)
    end_unit: str = Field(default="", max_length=150)
    count: int = Field(default=5, ge=1, le=10)
    left: str = Field(default="", max_length=80)
    right: str = Field(default="", max_length=80)
    explanation: str = Field(default="", max_length=6000)
    instructions: str = Field(default="", max_length=2000)


class AgentPlan(BaseModel):
    status: Literal["clarify", "execute"]
    message: str = Field(min_length=1, max_length=2000)
    tasks: list[AgentTask] = Field(default_factory=list, max_length=3)


class AgentRequest(StudyRequest):
    reset_scope: bool = False
    report_template_id: str | None = Field(default=None, max_length=100)
    message: str = Field(min_length=1, max_length=6000)
    thread_id: str | None = Field(default=None, max_length=100)


class GradeRequest(BaseModel):
    answers: list[int | None] = Field(max_length=10)


class Label(BaseModel):
    id: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=100)
    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)
    explanation: str = Field(default="", max_length=1000)


class LabelsRequest(BaseModel):
    labels: list[Label] = Field(min_length=1, max_length=50)
    confirmed: bool


class FigureGrade(BaseModel):
    answers: dict[str, str]


class ReviewRequest(BaseModel):
    answer: str = Field(default="", max_length=4000)
    remembered: bool | None = None
