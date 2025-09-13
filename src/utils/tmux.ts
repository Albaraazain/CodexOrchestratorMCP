import { spawn } from 'child_process';

export async function checkTmuxAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn('tmux', ['-V']);
    let resolved = false;
    child.on('exit', (code) => {
      if (!resolved) {
        resolved = true;
        resolve(code === 0);
      }
    });
    child.on('error', () => {
      if (!resolved) {
        resolved = true;
        resolve(false);
      }
    });
  });
}

export interface TmuxResult {
  success: boolean;
  output?: string;
  error?: string;
}

export async function createTmuxSession(sessionName: string, command: string, workingDir?: string): Promise<TmuxResult> {
  return new Promise((resolve) => {
    const args = ['new-session', '-d', '-s', sessionName];
    if (workingDir) {
      args.push('-c', workingDir);
    }
    args.push(command);
    const child = spawn('tmux', args, { cwd: workingDir, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (d) => (stdout += String(d)));
    child.stderr?.on('data', (d) => (stderr += String(d)));
    child.on('exit', (code) => {
      resolve({ success: code === 0, output: stdout, error: stderr });
    });
    child.on('error', (err) => resolve({ success: false, error: String(err) }));
  });
}

export async function checkTmuxSessionExists(sessionName: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn('tmux', ['has-session', '-t', sessionName], { stdio: ['ignore', 'ignore', 'ignore'] });
    child.on('exit', (code) => resolve(code === 0));
    child.on('error', () => resolve(false));
  });
}

export async function killTmuxSession(sessionName: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn('tmux', ['kill-session', '-t', sessionName], { stdio: ['ignore', 'ignore', 'ignore'] });
    child.on('exit', (code) => resolve(code === 0));
    child.on('error', () => resolve(false));
  });
}

export async function getTmuxSessionOutput(sessionName: string): Promise<string> {
  return new Promise((resolve) => {
    const child = spawn('tmux', ['capture-pane', '-t', sessionName, '-p']);
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (d) => (stdout += String(d)));
    child.stderr?.on('data', (d) => (stderr += String(d)));
    child.on('exit', (code) => {
      if (code === 0) resolve(stdout);
      else resolve(`Error capturing output: ${stderr}`);
    });
    child.on('error', (err) => resolve(`Exception capturing output: ${String(err)}`));
  });
}


