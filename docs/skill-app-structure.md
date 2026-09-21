# project structure

- skills: all the skill in the apps, every folder should the standalone skill. So one app could includes multiple skills, structure would be like
```
├── SKILL.md              # required
├── agents/               # Codex / OpenAI-specific，optional
│   └── openai.yaml
├── scripts/              # Optional: The script that actually performs the work.
├── references/           # 
Optional: Additional files / domain knowledge
└── assets/               # Optional: template, image, schema, output
resources
```

refer to the https://agentskills.io/specification?utm_source=chatgpt.com

Also install the existed skill is recommend to, make the project as the pack of the skill to fulfill 



- tests: the test for every single skill or skill sets
- scrips: for the helper scrips like builder or anything
- package.json: not real npm project, but use the npm for the scripts management 