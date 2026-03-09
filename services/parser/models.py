from pydantic import BaseModel
from typing import List, Optional


class Experience(BaseModel):
    title: str = ""
    company: str = ""
    duration: str = ""
    description: str = ""


class Project(BaseModel):
    name: str = ""
    description: str = ""
    technologies: List[str] = []


class ParsedResume(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    skills: List[str] = []
    experience: List[Experience] = []
    projects: List[Project] = []
    education: List[str] = []
    summary: Optional[str] = None
    raw_markdown: str = ""
