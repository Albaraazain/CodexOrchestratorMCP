export function expandPath(inputPath: string): string {
  let output = inputPath.replace(/^~(?=$|\/|\\)/, process.env.HOME ?? '~');
  output = output.replace(/\$(\w+)|\${(\w+)}/g, (_: string, a: string, b: string) => {
    const key = a || b;
    return process.env[key] ?? '';
  });
  return output;
}


