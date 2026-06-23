import { appendFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

export async function writePendingScaffoldLog(config: {
  scaffoldId: string;
  projectPath: string;
  featureName: string;
  generatedFiles: string[];
}): Promise<void> {
  const { scaffoldId, projectPath, featureName, generatedFiles } = config;

  try {
    const logEntry = {
      timestamp: Date.now(),
      scaffoldId,
      projectPath,
      featureName,
      generatedFiles,
      operation: 'scaffold',
    };

    const tempLogFile = path.join(os.tmpdir(), `scaffold-mcp-pending-${scaffoldId}.jsonl`);
    await appendFile(tempLogFile, `${JSON.stringify(logEntry)}\n`, 'utf-8');
  } catch (error) {
    console.error('Failed to write pending scaffold log:', error);
  }
}
