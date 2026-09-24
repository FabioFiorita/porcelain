import { fileURLToPath } from 'node:url';

const emptyHome = fileURLToPath(new URL('.', import.meta.url));

process.env.GIT_CONFIG_GLOBAL = '/dev/null';
process.env.GIT_CONFIG_SYSTEM = '/dev/null';
process.env.GIT_CONFIG_NOSYSTEM = '1';
process.env.HOME = emptyHome;
process.env.XDG_CONFIG_HOME = emptyHome;
