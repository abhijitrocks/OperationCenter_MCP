from pydantic import BaseModel
from typing import Optional, List, Generic, TypeVar

T = TypeVar('T')

class PaginatedResult(BaseModel, Generic[T]):
    items: List[T]
    nextCursor: Optional[str]

class Tenant(BaseModel):
    id: int
    name: str
    metadata: dict

class Workbench(BaseModel):
    id: int
    tenantId: int
    code: str
    config: dict

class RequestModel(BaseModel):
    id: int
    tenantId: int
    workbenchId: int
    status: str
    payload: dict
    createdAt: str

class Task(BaseModel):
    id: int
    requestId: int
    assigneeId: Optional[int]
    status: str
    createdAt: str

class Queue(BaseModel):
    id: int
    name: str
    workbenchId: int

class Role(BaseModel):
    id: int
    name: str
    permissions: List[str]

class Agent(BaseModel):
    id: int
    name: str
    capabilities: List[str]

class HealthStatus(BaseModel):
    slaMet: bool
    elapsed: float
    threshold: float

class Performance(BaseModel):
    totalTasks: int
    completedOnTime: int
    breachCount: int
