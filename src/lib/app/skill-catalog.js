export const CATALOG_CATEGORIES = [
  'Frontend',
  'Backend',
  'Database/Data',
  'AI/ML',
  'Mobile',
  'DevOps/Cloud',
  'Quality',
  'Security',
  'Design/Product',
];

export const CATALOG_SKILL_TYPES = ['capability', 'tool'];

export const STANDARD_SKILLS = [
  {
    key: 'frontend-react',
    name: 'React.js',
    aliases: ['React UI', 'React Components'],
    category: 'Frontend',
    skillType: 'tool',
    status: 'approved',
  },
  {
    key: 'frontend-vue',
    name: 'Vue.js',
    aliases: ['Vue UI', 'Vue Components'],
    category: 'Frontend',
    skillType: 'tool',
    status: 'approved',
  },
  {
    key: 'frontend-angular',
    name: 'Angular',
    aliases: ['Angular Framework', 'Angular SPA'],
    category: 'Frontend',
    skillType: 'tool',
    status: 'approved',
  },
  {
    key: 'frontend-nextjs',
    name: 'Next.js',
    aliases: ['Next App Router', 'Next Framework'],
    category: 'Frontend',
    skillType: 'tool',
    status: 'approved',
  },
  {
    key: 'frontend-typescript',
    name: 'TypeScript',
    aliases: ['TS Language', 'Typed JavaScript'],
    category: 'Frontend',
    skillType: 'tool',
    status: 'approved',
  },
  {
    key: 'frontend-tailwind',
    name: 'Tailwind CSS',
    aliases: ['Utility CSS', 'Tailwind Styling'],
    category: 'Frontend',
    skillType: 'tool',
    status: 'approved',
  },
  {
    key: 'frontend-accessibility',
    name: 'Web Accessibility',
    aliases: ['A11y', 'Inclusive UI'],
    category: 'Frontend',
    skillType: 'capability',
    status: 'approved',
  },
  {
    key: 'frontend-state-management',
    name: 'State Management',
    aliases: ['Client State', 'Frontend Stores'],
    category: 'Frontend',
    skillType: 'capability',
    status: 'approved',
  },
  {
    key: 'backend-nodejs',
    name: 'Node.js',
    aliases: ['Node Runtime', 'Server JavaScript'],
    category: 'Backend',
    skillType: 'tool',
    status: 'approved',
  },
  {
    key: 'backend-express',
    name: 'Express.js',
    aliases: ['Express API', 'Express Server'],
    category: 'Backend',
    skillType: 'tool',
    status: 'approved',
  },
  {
    key: 'backend-nestjs',
    name: 'NestJS',
    aliases: ['Nest Framework', 'Nest API'],
    category: 'Backend',
    skillType: 'tool',
    status: 'approved',
  },
  {
    key: 'backend-python',
    name: 'Python Backend',
    aliases: ['Python Services', 'Python APIs'],
    category: 'Backend',
    skillType: 'capability',
    status: 'approved',
  },
  {
    key: 'backend-django',
    name: 'Django',
    aliases: ['Django Framework', 'Django Web'],
    category: 'Backend',
    skillType: 'tool',
    status: 'approved',
  },
  {
    key: 'backend-fastapi',
    name: 'FastAPI',
    aliases: ['FastAPI Services', 'FastAPI Server'],
    category: 'Backend',
    skillType: 'tool',
    status: 'approved',
  },
  {
    key: 'backend-rest-api',
    name: 'REST API Design',
    aliases: ['RESTful APIs', 'HTTP API Design'],
    category: 'Backend',
    skillType: 'capability',
    status: 'approved',
  },
  {
    key: 'backend-graphql',
    name: 'GraphQL',
    aliases: ['GraphQL API', 'GraphQL Schema'],
    category: 'Backend',
    skillType: 'tool',
    status: 'approved',
  },
  {
    key: 'data-postgresql',
    name: 'PostgreSQL',
    aliases: ['Postgres', 'Postgres DB'],
    category: 'Database/Data',
    skillType: 'tool',
    status: 'approved',
  },
  {
    key: 'data-mysql',
    name: 'MySQL',
    aliases: ['MySQL DB', 'MySQL Database'],
    category: 'Database/Data',
    skillType: 'tool',
    status: 'approved',
  },
  {
    key: 'data-mongodb',
    name: 'MongoDB',
    aliases: ['Document Database', 'Mongo Store'],
    category: 'Database/Data',
    skillType: 'tool',
    status: 'approved',
  },
  {
    key: 'data-redis',
    name: 'Redis',
    aliases: ['Redis Cache', 'Key Value Store'],
    category: 'Database/Data',
    skillType: 'tool',
    status: 'approved',
  },
  {
    key: 'data-sql',
    name: 'SQL',
    aliases: ['SQL Queries', 'Relational Queries'],
    category: 'Database/Data',
    skillType: 'capability',
    status: 'approved',
  },
  {
    key: 'data-modeling',
    name: 'Data Modeling',
    aliases: ['Schema Design', 'Entity Modeling'],
    category: 'Database/Data',
    skillType: 'capability',
    status: 'approved',
  },
  {
    key: 'data-analytics',
    name: 'Data Analytics',
    aliases: ['Product Analytics', 'Analytics Reporting'],
    category: 'Database/Data',
    skillType: 'capability',
    status: 'approved',
  },
  {
    key: 'data-etl',
    name: 'ETL Pipelines',
    aliases: ['Data Pipelines', 'ELT Workflows'],
    category: 'Database/Data',
    skillType: 'capability',
    status: 'approved',
  },
  {
    key: 'aiml-prompt-engineering',
    name: 'Prompt Engineering',
    aliases: ['Prompt Design', 'LLM Prompting'],
    category: 'AI/ML',
    skillType: 'capability',
    status: 'approved',
  },
  {
    key: 'aiml-llm-integration',
    name: 'LLM Integration',
    aliases: ['AI Integration', 'Model API Integration'],
    category: 'AI/ML',
    skillType: 'capability',
    status: 'approved',
  },
  {
    key: 'aiml-rag',
    name: 'RAG',
    aliases: ['Retrieval Augmented Generation', 'Knowledge Retrieval'],
    category: 'AI/ML',
    skillType: 'capability',
    status: 'approved',
  },
  {
    key: 'aiml-embeddings',
    name: 'Embeddings',
    aliases: ['Vector Embeddings', 'Semantic Vectors'],
    category: 'AI/ML',
    skillType: 'capability',
    status: 'approved',
  },
  {
    key: 'aiml-vector-databases',
    name: 'Vector Databases',
    aliases: ['Vector Search', 'Semantic Search'],
    category: 'AI/ML',
    skillType: 'tool',
    status: 'approved',
  },
  {
    key: 'aiml-machine-learning',
    name: 'Machine Learning',
    aliases: ['ML Models', 'Predictive Models'],
    category: 'AI/ML',
    skillType: 'capability',
    status: 'approved',
  },
  {
    key: 'mobile-react-native',
    name: 'React Native',
    aliases: ['RN Mobile', 'React Native Apps'],
    category: 'Mobile',
    skillType: 'tool',
    status: 'approved',
  },
  {
    key: 'mobile-flutter',
    name: 'Flutter',
    aliases: ['Flutter Apps', 'Dart Mobile'],
    category: 'Mobile',
    skillType: 'tool',
    status: 'approved',
  },
  {
    key: 'mobile-ios',
    name: 'iOS Development',
    aliases: ['Swift Apps', 'Apple Mobile'],
    category: 'Mobile',
    skillType: 'capability',
    status: 'approved',
  },
  {
    key: 'mobile-android',
    name: 'Android Development',
    aliases: ['Kotlin Apps', 'Android Apps'],
    category: 'Mobile',
    skillType: 'capability',
    status: 'approved',
  },
  {
    key: 'mobile-pwa',
    name: 'Progressive Web Apps',
    aliases: ['PWA', 'Offline Web Apps'],
    category: 'Mobile',
    skillType: 'capability',
    status: 'approved',
  },
  {
    key: 'devops-docker',
    name: 'Docker',
    aliases: ['Containers', 'Dockerfiles'],
    category: 'DevOps/Cloud',
    skillType: 'tool',
    status: 'approved',
  },
  {
    key: 'devops-kubernetes',
    name: 'Kubernetes',
    aliases: ['K8s', 'Container Orchestration'],
    category: 'DevOps/Cloud',
    skillType: 'tool',
    status: 'approved',
  },
  {
    key: 'devops-aws',
    name: 'AWS',
    aliases: ['Amazon Web Services', 'AWS Cloud'],
    category: 'DevOps/Cloud',
    skillType: 'tool',
    status: 'approved',
  },
  {
    key: 'devops-gcp',
    name: 'Google Cloud',
    aliases: ['GCP', 'Google Cloud Platform'],
    category: 'DevOps/Cloud',
    skillType: 'tool',
    status: 'approved',
  },
  {
    key: 'devops-azure',
    name: 'Azure',
    aliases: ['Microsoft Azure', 'Azure Cloud'],
    category: 'DevOps/Cloud',
    skillType: 'tool',
    status: 'approved',
  },
  {
    key: 'devops-cicd',
    name: 'CI/CD',
    aliases: ['Continuous Delivery', 'Build Pipelines'],
    category: 'DevOps/Cloud',
    skillType: 'capability',
    status: 'approved',
  },
  {
    key: 'devops-iac',
    name: 'Infrastructure as Code',
    aliases: ['IaC', 'Terraform Workflows'],
    category: 'DevOps/Cloud',
    skillType: 'capability',
    status: 'approved',
  },
  {
    key: 'devops-monitoring',
    name: 'Monitoring',
    aliases: ['Observability', 'Production Metrics'],
    category: 'DevOps/Cloud',
    skillType: 'capability',
    status: 'approved',
  },
  {
    key: 'quality-unit-testing',
    name: 'Unit Testing',
    aliases: ['Test Automation', 'Automated Unit Tests'],
    category: 'Quality',
    skillType: 'capability',
    status: 'approved',
  },
  {
    key: 'quality-integration-testing',
    name: 'Integration Testing',
    aliases: ['Service Tests', 'API Integration Tests'],
    category: 'Quality',
    skillType: 'capability',
    status: 'approved',
  },
  {
    key: 'quality-e2e-testing',
    name: 'End-to-End Testing',
    aliases: ['E2E Tests', 'Browser Tests'],
    category: 'Quality',
    skillType: 'capability',
    status: 'approved',
  },
  {
    key: 'quality-playwright',
    name: 'Playwright',
    aliases: ['Playwright Tests', 'Browser Automation'],
    category: 'Quality',
    skillType: 'tool',
    status: 'approved',
  },
  {
    key: 'quality-code-review',
    name: 'Code Review',
    aliases: ['Review Discipline', 'Pull Request Review'],
    category: 'Quality',
    skillType: 'capability',
    status: 'approved',
  },
  {
    key: 'quality-performance',
    name: 'Performance Testing',
    aliases: ['Load Testing', 'Benchmarking'],
    category: 'Quality',
    skillType: 'capability',
    status: 'approved',
  },
  {
    key: 'security-authentication',
    name: 'Authentication',
    aliases: ['Login Systems', 'Identity Auth'],
    category: 'Security',
    skillType: 'capability',
    status: 'approved',
  },
  {
    key: 'security-authorization',
    name: 'Authorization',
    aliases: ['Access Control', 'Permissions Design'],
    category: 'Security',
    skillType: 'capability',
    status: 'approved',
  },
  {
    key: 'security-owasp',
    name: 'OWASP',
    aliases: ['Web Security Risks', 'OWASP Top Ten'],
    category: 'Security',
    skillType: 'capability',
    status: 'approved',
  },
  {
    key: 'security-appsec',
    name: 'Application Security',
    aliases: ['AppSec', 'Secure Coding'],
    category: 'Security',
    skillType: 'capability',
    status: 'approved',
  },
  {
    key: 'security-secrets',
    name: 'Secrets Management',
    aliases: ['Credential Hygiene', 'Secret Rotation'],
    category: 'Security',
    skillType: 'capability',
    status: 'approved',
  },
  {
    key: 'design-ux-research',
    name: 'UX Research',
    aliases: ['User Research', 'Research Interviews'],
    category: 'Design/Product',
    skillType: 'capability',
    status: 'approved',
  },
  {
    key: 'design-ui-design',
    name: 'UI Design',
    aliases: ['Interface Design', 'Visual Interface'],
    category: 'Design/Product',
    skillType: 'capability',
    status: 'approved',
  },
  {
    key: 'design-design-systems',
    name: 'Design Systems',
    aliases: ['Component Libraries', 'UI Systems'],
    category: 'Design/Product',
    skillType: 'capability',
    status: 'approved',
  },
  {
    key: 'design-product-management',
    name: 'Product Management',
    aliases: ['Product Strategy', 'Roadmap Planning'],
    category: 'Design/Product',
    skillType: 'capability',
    status: 'approved',
  },
  {
    key: 'design-prototyping',
    name: 'Prototyping',
    aliases: ['Interactive Prototypes', 'Clickable Mockups'],
    category: 'Design/Product',
    skillType: 'capability',
    status: 'approved',
  },
  {
    key: 'design-figma',
    name: 'Figma',
    aliases: ['Figma Design', 'Figma Prototypes'],
    category: 'Design/Product',
    skillType: 'tool',
    status: 'approved',
  },
];

export function normalizeSkillName(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function validateStandardCatalog(catalog = STANDARD_SKILLS) {
  const errors = [];
  const keys = new Set();
  const aliases = new Map();
  const categories = new Set(CATALOG_CATEGORIES);
  const skillTypes = new Set(CATALOG_SKILL_TYPES);

  for (const skill of catalog) {
    if (keys.has(skill.key)) {
      errors.push(`Duplicate key: ${skill.key}`);
    }
    keys.add(skill.key);

    if (!categories.has(skill.category)) {
      errors.push(`Invalid category for ${skill.key}: ${skill.category}`);
    }

    if (!skillTypes.has(skill.skillType)) {
      errors.push(`Invalid skill type for ${skill.key}: ${skill.skillType}`);
    }

    if (skill.status !== 'approved') {
      errors.push(`Invalid status for ${skill.key}: ${skill.status}`);
    }

    for (const label of [skill.name, ...(skill.aliases ?? [])]) {
      const normalized = normalizeSkillName(label);
      const previousKey = aliases.get(normalized);

      if (previousKey) {
        errors.push(`Duplicate normalized label: ${label} duplicates ${previousKey}`);
      } else {
        aliases.set(normalized, skill.key);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}
