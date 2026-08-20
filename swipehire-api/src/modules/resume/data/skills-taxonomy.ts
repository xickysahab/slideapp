/**
 * The skill vocabulary the resume parser recognises.
 *
 * Architecture §6 calls for "a hardcoded skills-taxonomy array (50–100 common tech skills)" matched
 * case-insensitively against the extracted text. This is that list, weighted toward the Indian tech
 * market the demo's seed data describes.
 *
 * Two things it does beyond a plain string list:
 *
 * 1. **Aliases.** A resume says "NodeJS", "Node.js" or "node js"; all three have to land on the one
 *    canonical "Node.js", or the same person reads as having three different skills and the chip row
 *    fills up with near-duplicates.
 *
 * 2. **No bare one- and two-letter names.** "Go", "C" and "R" are real skills and terrible tokens —
 *    "go", "c" and "r" appear in ordinary prose constantly, and "R&D" alone would credit someone
 *    with R. They're listed under unambiguous aliases only (Golang, C++, C#). The cost is missing a
 *    resume that only ever writes "Go"; the alternative is a demo where every candidate appears to
 *    know R, which is far worse in front of a client.
 *
 * A TS module rather than JSON on purpose: `nest build` doesn't copy stray .json into dist without
 * extra asset config, and a matcher that silently finds zero skills in production would be a
 * miserable thing to debug.
 */

export interface SkillEntry {
  /** How the skill is displayed and stored. */
  canonical: string;
  /** Extra spellings found in real resumes. Matched case-insensitively. */
  aliases?: string[];
}

export const SKILLS_TAXONOMY: SkillEntry[] = [
  // ---- Languages ----
  { canonical: 'JavaScript', aliases: ['JS', 'ECMAScript'] },
  { canonical: 'TypeScript', aliases: ['TS'] },
  { canonical: 'Python', aliases: ['Python3'] },
  { canonical: 'Java' },
  { canonical: 'Kotlin' },
  { canonical: 'Swift' },
  { canonical: 'Golang', aliases: ['Go lang', 'Go-lang'] },
  { canonical: 'C++', aliases: ['CPP', 'C plus plus'] },
  { canonical: 'C#', aliases: ['C sharp', 'CSharp'] },
  { canonical: 'PHP' },
  { canonical: 'Ruby' },
  { canonical: 'Scala' },
  { canonical: 'Rust' },
  { canonical: 'Dart' },

  // ---- Frontend ----
  { canonical: 'React', aliases: ['ReactJS', 'React.js'] },
  { canonical: 'Next.js', aliases: ['NextJS'] },
  { canonical: 'Vue', aliases: ['VueJS', 'Vue.js'] },
  { canonical: 'Angular', aliases: ['AngularJS'] },
  { canonical: 'Svelte' },
  { canonical: 'Redux' },
  { canonical: 'HTML', aliases: ['HTML5'] },
  { canonical: 'CSS', aliases: ['CSS3'] },
  { canonical: 'Tailwind', aliases: ['Tailwind CSS', 'TailwindCSS'] },
  { canonical: 'SASS', aliases: ['SCSS'] },
  { canonical: 'Webpack' },
  { canonical: 'Vite' },

  // ---- Mobile ----
  { canonical: 'React Native', aliases: ['ReactNative'] },
  { canonical: 'Flutter' },
  { canonical: 'Android' },
  { canonical: 'iOS' },
  { canonical: 'SwiftUI' },
  { canonical: 'Jetpack Compose' },

  // ---- Backend / frameworks ----
  { canonical: 'Node.js', aliases: ['NodeJS', 'Node js', 'Node'] },
  { canonical: 'Express', aliases: ['ExpressJS', 'Express.js'] },
  { canonical: 'NestJS', aliases: ['Nest.js'] },
  { canonical: 'Django' },
  { canonical: 'Flask' },
  { canonical: 'FastAPI' },
  { canonical: 'Spring Boot', aliases: ['SpringBoot', 'Spring'] },
  { canonical: 'Rails', aliases: ['Ruby on Rails'] },
  { canonical: 'Laravel' },
  { canonical: 'GraphQL' },
  { canonical: 'REST API', aliases: ['RESTful', 'REST APIs'] },
  { canonical: 'gRPC' },
  { canonical: 'WebSockets', aliases: ['Socket.io', 'SocketIO'] },
  { canonical: 'Microservices' },

  // ---- Databases ----
  { canonical: 'Postgres', aliases: ['PostgreSQL', 'Postgre SQL'] },
  { canonical: 'MySQL' },
  { canonical: 'MongoDB', aliases: ['Mongo'] },
  { canonical: 'Redis' },
  { canonical: 'SQL' },
  { canonical: 'DynamoDB' },
  { canonical: 'Cassandra' },
  { canonical: 'Elasticsearch', aliases: ['Elastic Search', 'OpenSearch'] },
  { canonical: 'SQLite' },
  { canonical: 'Firebase', aliases: ['Firestore'] },
  { canonical: 'Supabase' },

  // ---- Cloud / infra ----
  { canonical: 'AWS', aliases: ['Amazon Web Services'] },
  { canonical: 'GCP', aliases: ['Google Cloud', 'Google Cloud Platform'] },
  { canonical: 'Azure', aliases: ['Microsoft Azure'] },
  { canonical: 'Docker' },
  { canonical: 'Kubernetes', aliases: ['K8s'] },
  { canonical: 'Terraform' },
  { canonical: 'Jenkins' },
  { canonical: 'CI/CD', aliases: ['CICD', 'Continuous Integration'] },
  { canonical: 'GitHub Actions' },
  { canonical: 'Nginx' },
  { canonical: 'Linux' },
  { canonical: 'Serverless', aliases: ['AWS Lambda', 'Lambda'] },
  { canonical: 'Prometheus' },
  { canonical: 'Grafana' },

  // ---- Data / ML ----
  { canonical: 'Machine Learning', aliases: ['ML'] },
  { canonical: 'Deep Learning' },
  { canonical: 'TensorFlow' },
  { canonical: 'PyTorch' },
  { canonical: 'Pandas' },
  { canonical: 'NumPy' },
  { canonical: 'Scikit-learn', aliases: ['sklearn', 'Scikit learn'] },
  { canonical: 'Spark', aliases: ['Apache Spark', 'PySpark'] },
  { canonical: 'Airflow', aliases: ['Apache Airflow'] },
  { canonical: 'Kafka', aliases: ['Apache Kafka'] },
  { canonical: 'ETL' },
  { canonical: 'Power BI', aliases: ['PowerBI'] },
  { canonical: 'Tableau' },

  // ---- Practice / tooling ----
  { canonical: 'Git' },
  { canonical: 'Jira' },
  { canonical: 'Agile', aliases: ['Scrum'] },
  { canonical: 'System Design' },
  { canonical: 'Data Structures', aliases: ['DSA'] },
  { canonical: 'Unit Testing', aliases: ['Jest', 'PyTest', 'JUnit'] },
  { canonical: 'Selenium' },
  { canonical: 'Cypress' },
  { canonical: 'Figma' },
];

/** Flat list of canonical names, for validating a hand-edited skill against the vocabulary. */
export const CANONICAL_SKILLS: string[] = SKILLS_TAXONOMY.map((s) => s.canonical);
