"""Small engineering evaluation harness, not predictive demand validation."""

import json

import httpx
import pytest
import respx
from pydantic import ValidationError

from app.ai import AI, TOOLS, Explanation, Plan, supported, validate_explanation, validate_plan
from app.config import Settings
from app.models import Candidate, Evidence, Investigation, Question
from app.providers import now


def fixture():
    return Investigation(
        id="test",
        question=Question(text="EV charging in Austin?"),
        status="completed",
        createdAt=now(),
        candidates=[
            Candidate(
                id="a",
                name="A",
                coords=(-97.74, 30.27),
                geometry={},
                rank=1,
                scores=[],
                features={},
                rationale="Test",
                evidenceIds=["e1"],
                totalScore=70,
            )
        ],
        evidence=[
            Evidence(
                id="e1", sourceId="census", claim="Test supplied calculation", candidateIds=["a"]
            )
        ],
    )


def test_planner_scope_and_tools():
    assert supported("Where should EV charging open in Austin?")
    assert not supported("Coffee shop in Seattle")
    assert not supported("EV charging in Dallas")
    assert validate_plan(Plan(area="Austin, Texas", investigation_type="ev-charging", tools=TOOLS))
    with pytest.raises(ValueError, match="dependency order"):
        validate_plan(Plan(area="Austin, Texas", investigation_type="ev-charging", tools=["osm"]))
    with pytest.raises(ValidationError):
        Plan(area="Austin, Texas", investigation_type="ev-charging", tools=["invent_station"])


def test_citations_claims_limitations_and_ranking():
    inv = fixture()
    valid = Explanation(
        ranked_candidate_ids=["a"],
        observation_ids=["e1"],
        evidence_ids=["e1"],
        acknowledges_limitations=True,
    )
    assert validate_explanation(valid, inv)
    for update in (
        {"ranked_candidate_ids": ["b"]},
        {"observation_ids": ["invented demand"]},
        {"evidence_ids": ["missing"]},
        {"acknowledges_limitations": False},
        {"evidence_ids": []},
    ):
        with pytest.raises(ValueError):
            validate_explanation(valid.model_copy(update=update), inv)


@respx.mock
async def test_structured_tool_call_and_usage():
    plan = {"area": "Austin, Texas", "investigation_type": "ev-charging", "tools": TOOLS}
    route = respx.post("https://api.openai.com/v1/responses").respond(
        200,
        json={
            "status": "completed",
            "output": [
                {
                    "type": "function_call",
                    "name": "plan_austin_investigation",
                    "arguments": json.dumps(plan),
                }
            ],
            "usage": {"total_tokens": 120},
        },
    )
    ai = AI(
        Settings(enable_openai=True, openai_api_key="test", openai_model="test-model"),
        httpx.AsyncClient(),
    )
    assert (await ai.plan("EV charging in Austin?")).tools == TOOLS
    assert ai.usage["total_tokens"] == 120
    payload = json.loads(route.calls[0].request.content)
    assert payload["tools"][0]["strict"] and payload["max_output_tokens"] == 1800
