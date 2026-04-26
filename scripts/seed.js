/**
 * Seed script — creates 100 users + 10 tasks per user (1 000 tasks total)
 *
 * Environment variables (all optional — defaults work with docker-compose):
 *   AUTH_MONGODB_URI  (default: mongodb://localhost:27017/auth-db)
 *   USER_MONGODB_URI  (default: mongodb://localhost:27017/user-db)
 *   TASK_MONGODB_URI  (default: mongodb://localhost:27017/task-db)
 *
 * Run locally (MongoDB on localhost):
 *   node seed.js
 *
 * Run against docker-compose stack (exposed ports):
 *   AUTH_MONGODB_URI=mongodb://localhost:27017/auth-db \
 *   USER_MONGODB_URI=mongodb://localhost:27018/user-db \
 *   TASK_MONGODB_URI=mongodb://localhost:27019/task-db \
 *   node seed.js
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// ── Connection URIs ──────────────────────────────────────────────────────────
const AUTH_URI = process.env.AUTH_MONGODB_URI || 'mongodb://localhost:27017/auth-db';
const USER_URI = process.env.USER_MONGODB_URI || 'mongodb://localhost:27017/user-db';
const TASK_URI = process.env.TASK_MONGODB_URI || 'mongodb://localhost:27017/task-db';

// ── Seed constants ───────────────────────────────────────────────────────────
const USER_COUNT = 100;
const TASKS_PER_USER = 10;
const DEFAULT_PASSWORD = 'Password123';   // all seed users share this password

// ── Realistic data pools ─────────────────────────────────────────────────────
const FIRST_NAMES = [
  'Aarav','Aiden','Amelia','Aria','Arjun','Aryan','Bella','Benjamin','Caleb','Charlotte',
  'Chloe','Daniel','David','Elena','Elijah','Emily','Emma','Ethan','Eva','Grace',
  'Harper','Henry','Isabella','James','Jasmine','Jason','Jordan','Julia','Kevin','Kiran',
  'Layla','Liam','Lily','Lucas','Luna','Madison','Marcus','Maya','Michael','Mia',
  'Nathan','Natalie','Noah','Nora','Oliver','Olivia','Omar','Priya','Quinn','Rachel',
  'Rahul','Rebecca','Riley','Rohan','Ryan','Sahil','Samantha','Samuel','Sara','Sarah',
  'Scarlett','Sebastian','Shreya','Sia','Sofia','Sophie','Soren','Stella','Steven','Tanvi',
  'Thomas','Tia','Tyler','Uma','Victor','Victoria','Vikram','Violet','William','Zara',
  'Zoe','Ananya','Anika','Arjuna','Divya','Ishaan','Kavya','Meera','Nisha','Yash'
];

const LAST_NAMES = [
  'Anderson','Brown','Carter','Chen','Clark','Davis','Evans','Garcia','Gupta','Hall',
  'Harris','Hill','Jackson','Johnson','Jones','Khan','Kumar','Lee','Lewis','Martin',
  'Martinez','Miller','Mitchell','Moore','Nguyen','Patel','Perez','Robinson','Rodriguez',
  'Scott','Shah','Singh','Smith','Taylor','Thomas','Thompson','Turner','Walker','White','Wilson'
];

const DEPARTMENTS = [
  'Engineering','Product','Design','Marketing','Sales','Finance',
  'HR','Operations','DevOps','QA','Data Science','Customer Success'
];

const BIOS = [
  'Passionate about building scalable systems.',
  'Full-stack developer with a love for clean code.',
  'DevOps enthusiast and cloud architect.',
  'Product thinker who codes.',
  'Making complex things simple, one commit at a time.',
  'Open source contributor and weekend hacker.',
  'Turning coffee into code since 2015.',
  'Obsessed with performance and developer experience.',
  'Bridging the gap between design and engineering.',
  'Data-driven decision maker and ML enthusiast.',
  'Building the future, one microservice at a time.',
  'Firm believer in test-driven development.',
  'Security-first mindset in everything I build.',
  'API designer by day, retro gamer by night.',
  'Loves Kubernetes, hates YAML (but uses it anyway).',
];

const TASK_TEMPLATES = [
  // Format: { title, description, priority }
  { title: 'Set up CI/CD pipeline', description: 'Configure GitHub Actions for automated build and deploy.', priority: 'high' },
  { title: 'Write unit tests for auth module', description: 'Achieve 80% code coverage on the authentication service.', priority: 'high' },
  { title: 'Refactor database layer', description: 'Extract repository pattern and clean up Mongoose queries.', priority: 'medium' },
  { title: 'Design system component library', description: 'Build reusable Tailwind components for buttons, inputs, and cards.', priority: 'medium' },
  { title: 'Performance audit', description: 'Profile API response times and add indexes where needed.', priority: 'high' },
  { title: 'Update API documentation', description: 'Add OpenAPI/Swagger docs for all REST endpoints.', priority: 'low' },
  { title: 'Implement pagination on task list', description: 'Add cursor-based pagination for large result sets.', priority: 'medium' },
  { title: 'Security review — dependency audit', description: 'Run npm audit and upgrade packages with CVEs.', priority: 'high' },
  { title: 'Add dark mode support', description: 'Implement Tailwind dark variant across all pages.', priority: 'low' },
  { title: 'Mobile responsive fixes', description: 'Fix overflow issues on screens smaller than 375px.', priority: 'medium' },
  { title: 'Implement email notifications', description: 'Send task assignment and due-date reminder emails.', priority: 'low' },
  { title: 'Migrate to TypeScript', description: 'Gradually add type annotations starting with shared models.', priority: 'low' },
  { title: 'Set up monitoring and alerts', description: 'Integrate Prometheus + Grafana and set SLO alert rules.', priority: 'high' },
  { title: 'Fix token refresh logic', description: 'Handle expired JWT gracefully without forcing re-login.', priority: 'high' },
  { title: 'Add rate limiting to public APIs', description: 'Protect endpoints from abuse using express-rate-limit.', priority: 'medium' },
  { title: 'Implement search functionality', description: 'Add full-text search across task titles and descriptions.', priority: 'medium' },
  { title: 'Set up error tracking', description: 'Integrate Sentry for frontend and backend error capture.', priority: 'medium' },
  { title: 'Code review backlog', description: 'Clear out 15 pending pull requests in the queue.', priority: 'high' },
  { title: 'Kubernetes resource tuning', description: 'Right-size CPU/memory limits based on real usage data.', priority: 'low' },
  { title: 'Onboard new team member', description: 'Prepare dev environment guide and pair-program for one week.', priority: 'medium' },
  { title: 'Write runbook for incidents', description: 'Document rollback procedure and on-call escalation path.', priority: 'high' },
  { title: 'Database backup strategy', description: 'Set up automated MongoDB backups with 30-day retention.', priority: 'high' },
  { title: 'A/B test login page', description: 'Test two variants of the login CTA to improve conversion.', priority: 'low' },
  { title: 'Upgrade Node.js to v22', description: 'Test compatibility and update Dockerfiles and CI matrix.', priority: 'medium' },
  { title: 'Implement audit logging', description: 'Log all user actions with timestamp and IP for compliance.', priority: 'medium' },
  { title: 'Clean up feature flags', description: 'Remove stale flags that shipped more than 60 days ago.', priority: 'low' },
  { title: 'Optimise Docker image sizes', description: 'Use multi-stage builds and alpine base to reduce image footprint.', priority: 'low' },
  { title: 'Fix CORS issues in staging', description: 'Allowed-origin list is blocking the staging frontend domain.', priority: 'high' },
  { title: 'Load test task creation endpoint', description: 'Simulate 500 concurrent users and measure P95 latency.', priority: 'medium' },
  { title: 'Implement CSV export', description: 'Allow users to export their task list as a CSV file.', priority: 'low' },
];

const STATUSES = ['todo', 'in-progress', 'done'];
const TAGS_POOL = [
  'backend','frontend','devops','urgent','bug','feature','refactor',
  'docs','testing','security','performance','ui','api','database','infra'
];

// ── Helpers ──────────────────────────────────────────────────────────────────
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const pickN = (arr, n) => [...arr].sort(() => 0.5 - Math.random()).slice(0, n);
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const futureDateWithin = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + randInt(1, days));
  return d;
};
const pastDate = (days) => {
  const d = new Date();
  d.setDate(d.getDate() - randInt(1, days));
  return d;
};

function generateUser(index) {
  const firstName = FIRST_NAMES[index % FIRST_NAMES.length];
  const lastName = pick(LAST_NAMES);
  const name = `${firstName} ${lastName}`;
  const emailLocal = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${index}`;
  const email = `${emailLocal}@taskflow.dev`;
  return { name, email, department: pick(DEPARTMENTS), bio: pick(BIOS) };
}

function generateTask(userId, index) {
  const template = TASK_TEMPLATES[index % TASK_TEMPLATES.length];
  const status = pick(STATUSES);
  const hasDueDate = Math.random() > 0.3;
  const dueDate = hasDueDate
    ? status === 'done' ? pastDate(30) : futureDateWithin(60)
    : undefined;
  const tags = pickN(TAGS_POOL, randInt(1, 3));
  return {
    title: template.title,
    description: template.description,
    status,
    priority: template.priority,
    dueDate,
    tags,
    userId,
  };
}

// ── Mongoose Schemas (minimal — must match service schemas) ──────────────────
function buildAuthSchema() {
  const s = new mongoose.Schema(
    {
      name: String,
      email: { type: String, unique: true },
      password: { type: String, select: false },
      role: { type: String, default: 'user' },
      isActive: { type: Boolean, default: true },
    },
    { timestamps: true }
  );
  return s;
}

function buildUserProfileSchema() {
  return new mongoose.Schema(
    { userId: { type: String, unique: true }, name: String, email: String, bio: String, department: String },
    { timestamps: true }
  );
}

function buildTaskSchema() {
  return new mongoose.Schema(
    { title: String, description: String, status: String, priority: String, dueDate: Date, tags: [String], userId: String },
    { timestamps: true }
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🌱  TaskFlow Database Seeder');
  console.log(`   Users:  ${USER_COUNT}`);
  console.log(`   Tasks:  ${USER_COUNT * TASKS_PER_USER} (${TASKS_PER_USER} per user)\n`);

  // Open three separate connections
  const authConn = await mongoose.createConnection(AUTH_URI).asPromise();
  const userConn = await mongoose.createConnection(USER_URI).asPromise();
  const taskConn = await mongoose.createConnection(TASK_URI).asPromise();
  console.log('✅  Connected to all 3 MongoDB databases');

  const AuthUser      = authConn.model('User', buildAuthSchema());
  const UserProfile   = userConn.model('UserProfile', buildUserProfileSchema());
  const Task          = taskConn.model('Task', buildTaskSchema());

  // Clear existing seed data
  await AuthUser.deleteMany({});
  await UserProfile.deleteMany({});
  await Task.deleteMany({});
  console.log('🗑️   Cleared existing data\n');

  // Hash the shared password once (bcrypt is slow — do it once and reuse)
  const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 12);
  console.log('🔐  Password hashed (bcrypt cost 12)');

  // Build user records
  const authUsers = [];
  const userProfiles = [];
  const now = new Date();

  for (let i = 0; i < USER_COUNT; i++) {
    const data = generateUser(i);
    const authDoc = {
      name: data.name,
      email: data.email,
      password: hashedPassword,
      role: i === 0 ? 'admin' : 'user',   // first user is admin
      isActive: true,
      createdAt: new Date(now - randInt(0, 90) * 86400000),
    };
    authUsers.push(authDoc);
  }

  // Insert auth users
  process.stdout.write(`\n👤  Inserting ${USER_COUNT} users...`);
  const insertedAuth = await AuthUser.insertMany(authUsers, { ordered: false });
  console.log(' done ✅');

  // Build user profiles using the inserted _id values
  for (const authDoc of insertedAuth) {
    const raw = authUsers.find((u) => u.email === authDoc.email);
    userProfiles.push({
      userId: authDoc._id.toString(),
      name: authDoc.name,
      email: authDoc.email,
      bio: raw?.bio || '',
      department: authUsers.find((u) => u.email === authDoc.email)?.department || '',
    });
  }

  process.stdout.write(`👤  Inserting ${USER_COUNT} user profiles...`);
  await UserProfile.insertMany(userProfiles, { ordered: false });
  console.log(' done ✅');

  // Build tasks
  const allTasks = [];
  for (let u = 0; u < insertedAuth.length; u++) {
    const userId = insertedAuth[u]._id.toString();
    for (let t = 0; t < TASKS_PER_USER; t++) {
      allTasks.push(generateTask(userId, u * TASKS_PER_USER + t));
    }
  }

  process.stdout.write(`📋  Inserting ${allTasks.length} tasks...`);
  await Task.insertMany(allTasks, { ordered: false });
  console.log(' done ✅');

  // Summary
  const [authCount, userCount, taskCount] = await Promise.all([
    AuthUser.countDocuments(),
    UserProfile.countDocuments(),
    Task.countDocuments(),
  ]);

  // Status breakdown
  const taskStats = await Task.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);

  console.log('\n📊  Final counts:');
  console.log(`   auth-db  → Users:    ${authCount}`);
  console.log(`   user-db  → Profiles: ${userCount}`);
  console.log(`   task-db  → Tasks:    ${taskCount}`);
  console.log('\n   Task status breakdown:');
  taskStats.forEach(({ _id, count }) => console.log(`     ${_id.padEnd(12)}: ${count}`));

  console.log('\n🔑  Login with any seed user:');
  console.log(`   Email:    ${insertedAuth[0].email}  (admin)`);
  console.log(`   Email:    ${insertedAuth[1].email}  (user)`);
  console.log(`   Password: ${DEFAULT_PASSWORD}  (all users)\n`);

  await authConn.close();
  await userConn.close();
  await taskConn.close();
  console.log('👋  Done — connections closed.\n');
}

main().catch((err) => {
  console.error('\n❌  Seed failed:', err.message);
  process.exit(1);
});
