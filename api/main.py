import os
import tempfile
from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from services.parser.models import ParsedResume
from services.parser.parser import parse_pdf, parse_text
from services.question_gen.generator import generate_questions
from services.question_gen.models import InterviewScript
from services.scoring.models import ResponseScore
from services.scoring.response_scorer import score_response

app = FastAPI(
    title="AI Interviewer — Parser & Question Generator",
    description="Parse resumes (PDF/text) and generate structured interview scripts via Ollama.",
    version="1.0.0",
)


# ── Parse endpoints ───────────────────────────────────────────────────────────

@app.post("/parse/pdf", response_model=ParsedResume, tags=["Parse"])
async def parse_resume_pdf(file: UploadFile = File(...)):
    """Upload a PDF resume → get structured parsed data."""
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try:
        return parse_pdf(tmp_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Parsing failed: {e}")
    finally:
        os.unlink(tmp_path)


@app.post("/parse/text", response_model=ParsedResume, tags=["Parse"])
async def parse_resume_text(text: str = Form(...)):
    """Submit plain text/markdown resume → get structured parsed data."""
    return parse_text(text)


# ── Question generation endpoints ─────────────────────────────────────────────

class QuestionGenRequest(BaseModel):
    resume_markdown: Optional[str] = ""
    job_description: Optional[str] = ""
    model: Optional[str] = "qwen2.5:7b"
    ollama_url: Optional[str] = "http://localhost:11434"


@app.post("/generate-questions", response_model=InterviewScript, tags=["Questions"])
async def generate_interview_questions(request: QuestionGenRequest):
    """Generate interview questions from resume markdown and/or job description."""
    if not request.resume_markdown and not request.job_description:
        raise HTTPException(status_code=400, detail="Provide resume_markdown and/or job_description.")

    try:
        return generate_questions(
            resume_markdown=request.resume_markdown or "",
            job_description=request.job_description or "",
            model=request.model,
            ollama_url=request.ollama_url,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Generation failed: {e}")


# ── Combined endpoint ─────────────────────────────────────────────────────────

@app.post("/parse-and-generate", tags=["Combined"])
async def parse_and_generate(
    file: Optional[UploadFile] = File(None),
    job_description: str = Form(""),
    model: str = Form("qwen2.5:7b"),
    ollama_url: str = Form("http://localhost:11434"),
):
    """Upload PDF resume + optional job description → parse + generate questions in one call."""
    parsed: Optional[ParsedResume] = None
    resume_markdown = ""

    if file:
        if not file.filename.lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail="Only PDF files are supported.")
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp.write(await file.read())
            tmp_path = tmp.name
        try:
            parsed = parse_pdf(tmp_path)
            resume_markdown = parsed.raw_markdown
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"PDF parsing failed: {e}")
        finally:
            os.unlink(tmp_path)

    if not resume_markdown and not job_description:
        raise HTTPException(status_code=400, detail="Provide a PDF resume and/or job_description.")

    try:
        script = generate_questions(
            resume_markdown=resume_markdown,
            job_description=job_description,
            model=model,
            ollama_url=ollama_url,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Question generation failed: {e}")

    return {
        "parsed_resume": parsed,
        "interview_script": script,
    }


# ── Scoring endpoint ──────────────────────────────────────────────────────────

class ScoreRequest(BaseModel):
    question_id: str
    transcript: str
    ideal_answer: str


@app.post("/score/response", response_model=ResponseScore, tags=["Scoring"])
async def score_candidate_response(request: ScoreRequest):
    """
    Score a candidate's Whisper transcript against the question's ideal_answer.
    Returns semantic similarity, VADER sentiment, engagement flag, and combined score (0-10).
    """
    if not request.transcript.strip():
        raise HTTPException(status_code=400, detail="transcript must not be empty.")
    if not request.ideal_answer.strip():
        raise HTTPException(status_code=400, detail="ideal_answer must not be empty.")

    try:
        return score_response(
            question_id=request.question_id,
            transcript=request.transcript,
            ideal_answer=request.ideal_answer,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scoring failed: {e}")


@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok"}
