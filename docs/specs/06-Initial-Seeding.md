# InTheFlow: Database Seeding Specification

This document details the database seeding logic and lists all tasks, categories, statuses, and project mappings imported during database initialization.

---

## 1. Database Seeding Process

When the FastAPI server starts up, it checks if any tasks exist in the `Task` table. If the table is empty, it executes the seeding pipeline:
1. **Create Default Projects**: Populates the `Project` table with the known projects and their signature glassmorphic colors.
2. **Resolve Task-to-Project Mappings**: Maps the raw text of projects from the Notion export and plans to the created `Project` entities.
3. **Insert Tasks**: Creates SQLModel instances for each seeded task and saves them to SQLite.

### Seeding Logic (`backend/database.py` excerpt)
```python
import json
import os
from sqlmodel import Session
from database import Project, Task, engine

DEFAULT_PROJECTS = [
    {"name": "Sample Project", "color": "#3B82F6", "description": "Production DDD/CQRS/Event Sourcing platform"},
    {"name": "StoryWeaver", "color": "#10B981", "description": "Interactive storytelling AI variation engine"},
    {"name": "Evaluate Coaching platform business opportunity", "color": "#6B7280", "description": "Coaching platform opportunity analysis"},
    {"name": "Learn Business validation & Present it", "color": "#F59E0B", "description": "Research on business validation methodologies"},
    {"name": "Put in place a digital organization system", "color": "#8B5CF6", "description": "PARA and digital productivity experiments"},
    {"name": "Set up a pre-meeting workflow", "color": "#EC4899", "description": "Meetings pre-flight checklists"},
    {"name": "Productivity & Agents", "color": "#D97706", "description": "LinkedIn commenting and AI agent productivity workflows"},
    {"name": "Workflows", "color": "#06B6D4", "description": "Business workflows and specifications"},
    {"name": "Distribution", "color": "#3F51B5", "description": "Distribution channels evaluation"},
    {"name": "Chat Widget", "color": "#E91E63", "description": "Embeddable chat widget technical specifications"},
    {"name": "Demo Strategy", "color": "#8BC34A", "description": "Initial industry and company demo strategies"},
    {"name": "ICP Definition", "color": "#FF5722", "description": "Ideal Customer Profile mapping"}
]

def seed_database(session: Session):
    # 1. Seed Projects
    project_map = {}
    for p_info in DEFAULT_PROJECTS:
        # Check if already exists
        existing = session.query(Project).filter(Project.name == p_info["name"]).first()
        if not existing:
            project = Project(name=p_info["name"], color=p_info["color"], description=p_info["description"])
            session.add(project)
            session.commit()
            session.refresh(project)
            project_map[project.name] = project.id
        else:
            project_map[existing.name] = existing.id

    # 2. Seed Tasks if empty
    task_count = session.query(Task).count()
    if task_count == 0:
        # Load seed tasks JSON file
        seed_file = os.path.join(os.path.dirname(__file__), "seed_tasks.json")
        if os.path.exists(seed_file):
            with open(seed_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                
            # Parse Business Tasks
            for t_info in data.get("business", []):
                proj_name = clean_project_name(t_info["project"])
                proj_id = project_map.get(proj_name)
                task = Task(
                    name=t_info["name"],
                    status=normalize_status(t_info["status"]),
                    category="business",
                    source=t_info["source"],
                    project_id=proj_id
                )
                session.add(task)
                
            # Parse Technical Tasks
            for t_info in data.get("technical", []):
                proj_name = clean_project_name(t_info["project"])
                proj_id = project_map.get(proj_name)
                task = Task(
                    name=t_info["name"],
                    status=normalize_status(t_info["status"]),
                    category="dev",
                    source=t_info["source"],
                    project_id=proj_id
                )
                session.add(task)
                
            session.commit()

def clean_project_name(raw_name: str) -> str:
    # Remove notion links inside parenthesis
    if "(" in raw_name:
        return raw_name.split("(")[0].strip()
    return raw_name.strip()

def normalize_status(raw_status: str) -> str:
    status_lower = raw_status.lower()
    if "progress" in status_lower: return "in_progress"
    if "start" in status_lower: return "ready_to_start"
    if "prioritized" in status_lower: return "ready_to_start"
    if "hold" in status_lower: return "on_hold"
    return "backlog"
```

---

## 2. Seed Task Dataset

### Business Tasks (65 items)

| # | Task Name | Status | Project | Category | Source |
|---|---|---|---|---|---|
| 1 | Read some chapters on Book - Testing Business Ideas | Prioritized Week | Learn Business validation & Present it | Business | NotionArch |
| 2 | Global M.M - Building Second Brain Book | Ready To Start | Put in place a digital organization system | Business | NotionArch |
| 3 | Prepare Meeting | In Progress | Set up a pre-meeting workflow | Business | NotionArch |
| 4 | Summarize Digital Habits Chapter - Building Second Brain Book | Ready To Start | Put in place a digital organization system | Business | NotionArch |
| 5 | Read some chapters on Book - Build insanely great products | Ready To Start | Learn Business validation & Present it | Business | NotionArch |
| 6 | Workflow for Time Management | In Progress | Evaluate Coaching platform business opportunity | Business | NotionArch |
| 7 | Workflow for Achieve a goal | In Progress | Evaluate Coaching platform business opportunity | Business | NotionArch |
| 8 | Create Testing Prototypes | Prioritized Week | Evaluate Coaching platform business opportunity | Business | NotionArch |
| 9 | Test Workflows by us | Prioritized Week | Evaluate Coaching platform business opportunity | Business | NotionArch |
| 10 | Test workflow by others | Prioritized Week | Evaluate Coaching platform business opportunity | Business | NotionArch |
| 11 | Define Testing Criterias (Experiment) | Prioritized Week | Evaluate Coaching platform business opportunity | Business | NotionArch |
| 12 | Create Landing Page | Prioritized Week | Evaluate Coaching platform business opportunity | Business | NotionArch |
| 13 | Launch Landing Page | Prioritized Week | Evaluate Coaching platform business opportunity | Business | NotionArch |
| 14 | Create App Mockups | Prioritized Week | Evaluate Coaching platform business opportunity | Business | NotionArch |
| 15 | Create Landing Page Structure + Content | Prioritized Week | Evaluate Coaching platform business opportunity | Business | NotionArch |
| 16 | test | On Hold | Evaluate Coaching platform business opportunity | Business | NotionArch |
| 17 | Analyse Subreddits content and create Claude projects per subReddit | Prioritized Week | StoryWeaver | Marketing | NotionArch |
| 18 | Check Legal requirements for stripe | Prioritized Week | StoryWeaver | Legal | NotionArch |
| 19 | Check Need for SAAS from the start | Prioritized Week | StoryWeaver | Legal | NotionArch |
| 20 | Quick Check COPPA | In Progress | StoryWeaver | Legal | NotionArch |
| 21 | Schedule & Determine Daily & Weekly Meetings Formats | Prioritized Week | Sample Project | Business | NotionArch |
| 22 | Determine Detailed Initial Features | On Hold | Sample Project | Business | NotionArch |
| 23 | Improve life Situation Stories Images | Ready To Start | StoryWeaver | Business | NotionArch |
| 24 | Setup Marketing Startegy | Ready To Start | StoryWeaver | Marketing | NotionArch |
| 25 | Review 4 initial stories & correct if necessary for each learning path | Ready To Start | StoryWeaver | Business | NotionArch |
| 26 | Read & Summarize DotComSecrets | On Hold | Sample Project | Business | NotionArch |
| 27 | Summarize & Mindmap Obviously awesome | On Hold | Sample Project | Business | NotionArch |
| 28 | Revisit testing business idea book | On Hold | Sample Project | Business | NotionArch |
| 29 | Create Book Summary & Insights playbook | On Hold | Sample Project | Business | NotionArch |
| 30 | Summarize & Mind Map Value Prop | On Hold | Sample Project | Business | NotionArch |
| 31 | Review Builder Fit | Prioritized Week | Sample Project | Business | NotionArch |
| 32 | Review Positioning Canva | Prioritized Week | Sample Project | Business | NotionArch |
| 33 | Detailed App Prototyping | Prioritized Week | Sample Project | Business | NotionArch |
| 34 | Create Financial Model | Ready To Start | Sample Project | Business | NotionArch |
| 35 | Create Business execution roadmap | Prioritized Week | Sample Project | Business | NotionArch |
| 36 | Review Business Fit | Prioritized Week | Sample Project | Business | NotionArch |
| 37 | Draft Designer Fast Specs | On Hold | Sample Project | Business | NotionArch |
| 38 | Check Sovereignty model resilience | On Hold | Sample Project | Business | NotionArch |
| 39 | Study Marketing Channels | Prioritized Week | Sample Project | Business | NotionArch |
| 40 | Define Week 27-03 April/May Posts | In Progress | Sample Project | Business | NotionArch |
| 41 | Test Stitch/Claude/ChatGpt Flow for infographics | Prioritized Week | Sample Project | Business | NotionArch |
| 42 | Brainstorm Distribution Initial Steps for Sample Project | In Progress | Sample Project | Business | NotionArch |
| 43 | Read Traction Book & Synthetize takeaways | In Progress | Sample Project | Business | NotionArch |
| 44 | Analyse Posts for the past week on selected Accounts | In Progress | Sample Project | Business | NotionArch |
| 45 | Create Linked in Learning Cards | In Progress | Sample Project | Business | NotionArch |
| 46 | Identify Linkedin Framework strategy & Create skill for double verification after post draft | In Progress | Sample Project | Business | NotionArch |
| 47 | Identify framework for sharing analysis of posts of selected accounts | Prioritized Week | Sample Project | Business | NotionArch |
| 48 | Identify SOPs for Business repository folders & boundary with Notion | In Progress | Sample Project | Business | NotionArch |
| 49 | test | In Progress | Sample Project | BusinessAnalysis | NotionArch |
| 50 | test | In Progress | Sample Project | BusinessAnalysis | NotionArch |
| 51 | Determine more precisely the MVP ICP and marketing ICP and demo ICP | Prioritized Week | Sample Project | Business | NotionArch |
| 52 | review Hypotheses & Impacts on roadmap & pivots & Create SWOT analysis | Prioritized Week | Sample Project | Business | NotionArch |
| 53 | Create Notion or Obsidian Hypthoses Experiments & Learning cards table | Ready To Start | Sample Project | Business | NotionArch |
| 54 | Create V2 for value proposition | Prioritized Week | Sample Project | Business | NotionArch |
| 55 | Brainstorm initial Steps for Sample Project | In Progress | Sample Project | Business | NotionArch |
| 56 | Research Case for demoable company | Prioritized Week | Sample Project | Business | NotionArch |
| 57 | Create Business Follow up documents & Draw IO | Prioritized Week | Sample Project | Business | NotionArch |
| 58 | LinkedIn Commenting (Daily Strategy) | In Progress | Productivity & Agents | Business | Planning |
| 59 | LinkedIn Content Strategy (Daily Posting) | In Progress | Productivity & Agents | Business | Planning |
| 60 | Workflows (Draft business specifications with Bob) | Ready To Start | Workflows | Business | Planning |
| 61 | Distribution Strategy (Brainstorm & evaluate channels: Email, Reddit, X) | Ready To Start | Distribution | Business | Planning |
| 62 | Chat Widget (Assess technical feasibility of embeddable chat widget) | Ready To Start | Chat Widget | Business | Planning |
| 63 | Demo Strategy (Brainstorm initial industry & demo company) | Ready To Start | Demo Strategy | Business | Planning |
| 64 | ICP Definition (Define Broader, Marketing, and Demo ICPs) | Ready To Start | ICP Definition | Business | Planning |
| 65 | Productivity Agents (Experiment with AI agents for developer productivity) | Ready To Start | Productivity & Agents | Business | Planning |

### Technical Tasks (9 items)

| # | Task Name | Status | Project | Category | Source |
|---|---|---|---|---|---|
| 1 | AI Chat API - Quality Tests codebase compliance review | In Progress | AI Chat API | Dev | Planning |
| 2 | AI Chat API - UI Tool: Utilities JSON chat debugger | In Progress | AI Chat API | Dev | Planning |
| 3 | AI Chat API - Frontend AI Chat page with DSL display | In Progress | AI Chat API | Dev | Planning |
| 4 | Access Control API - OrgUserProfile implementation | Ready To Start | Access Control | Dev | Planning |
| 5 | Access Control API - OrgAuthorizationProfile implementation | Ready To Start | Access Control | Dev | Planning |
| 6 | Access Control API - ApiDataSourceAuthorization implementation | Ready To Start | Access Control | Dev | Planning |
| 7 | Access Control API - OrgAuthorizationInvitation implementation | Ready To Start | Access Control | Dev | Planning |
| 8 | AI DSM Middleware - aiDescription schema enrichment middleware | Ready To Start | AI DSM Middleware | Dev | Planning |
| 9 | Zod Schema Validator - Test validator on ProductInventory/ProductCategory | Ready To Start | Zod Validator | Dev | Planning |
