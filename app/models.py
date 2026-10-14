from typing import Literal

from pydantic import BaseModel, Field


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


class Report(BaseModel):
    title: str
    sections: list[ReportSection] = Field(min_length=5, max_length=5)
    pre_questions: list[Question] = Field(min_length=2, max_length=4)


class StudyRequest(BaseModel):
    course: str
    material_ids: list[str] = Field(default_factory=list, max_length=50)
    topic: str = Field(default="", max_length=1000)


class ChatRequest(StudyRequest):
    message: str = Field(min_length=1, max_length=6000)
    history: list[dict[str, str]] = Field(default_factory=list, max_length=12)


class FeedbackRequest(StudyRequest):
    explanation: str = Field(min_length=5, max_length=6000)


class QuizRequest(StudyRequest):
    count: int = Field(default=5, ge=2, le=10)
    mode: Literal["章节小测", "易混辨别"] = "章节小测"


class CompareRequest(StudyRequest):
    left: str = Field(min_length=1, max_length=80)
    right: str = Field(min_length=1, max_length=80)


class ReportRequest(StudyRequest):
    title: str = Field(min_length=1, max_length=100)
    template_id: str | None = None


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
