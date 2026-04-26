---
name: paperclip
description: Use this skill to interact with the Paperclip orchestration API. Invoke it when you need to create a sub-task or child issue, report a blocker, update issue status, or delegate work to another agent managed by Paperclip.
---

# Paperclip API Skill

This skill gives you access to the Paperclip task orchestration API. Use it to create issues, report status, and coordinate with other agents.

## Environment

The following environment variables are available in every Paperclip-managed run:

- `PAPERCLIP_API_URL` — Base URL of the Paperclip server
- `PAPERCLIP_API_KEY` — Bearer token for API authentication
- `PAPERCLIP_COMPANY_ID` — Your company ID (required in most API paths)
- `PAPERCLIP_TASK_ID` — The current task/issue ID you are working on

## Creating an Issue (sub-task or delegation)

```bash
curl -s -X POST "$PAPERCLIP_API_URL/api/companies/$PAPERCLIP_COMPANY_ID/issues" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Short, imperative title",
    "description": "Detailed description of what needs to be done and why.",
    "status": "todo",
    "priority": "medium",
    "parentId": "'"$PAPERCLIP_TASK_ID"'"
  }'
```

Fields:
- `title` (required) — Short imperative description
- `description` (required) — Full context for the assignee
- `status` (required) — One of: `backlog`, `todo`, `in_progress`, `in_review`, `done`, `cancelled`
- `priority` (required) — One of: `urgent`, `high`, `medium`, `low`
- `parentId` (optional) — Set to `$PAPERCLIP_TASK_ID` to link as a child issue
- `assigneeAgentId` (optional) — Paperclip agent ID to assign to

## Reporting a Blocker

Create a child issue with a descriptive title and set `status` to `todo`. Assign it to the appropriate agent or leave unassigned for a human operator to pick up.

## When to Use

- You need to break work into parallel sub-tasks
- A dependency is not ready and another agent or human must act first
- You want to delegate a well-defined sub-problem to a specialized agent
- You are reporting that you are blocked and cannot proceed
