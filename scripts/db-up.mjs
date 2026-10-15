import { spawnSync } from 'node:child_process';
// Compose can be newer than the local engine. Negotiate explicitly first.
const version = spawnSync('docker', ['version', '--format', '{{.Server.APIVersion}}'], { encoding: 'utf8', timeout: 20000 });
if (version.status !== 0 || !/^\d+\.\d+$/.test(version.stdout.trim())) {
  console.error('Docker engine is unavailable. Start Docker Desktop, then retry pnpm db:up.');
  process.exit(1);
}
const result = spawnSync('docker', ['compose', 'up', '-d', '--wait', 'postgres'], {
  stdio: 'inherit', env: { ...process.env, DOCKER_API_VERSION: version.stdout.trim() },
});
process.exit(result.status ?? 1);
