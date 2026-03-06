/**
 * DefinitionsCacheService
 *
 * Provides shared discovery, caching, and serialization for startup-time MCP
 * capability metadata. This avoids repeated remote enumeration during
 * mcp-serve startup and describe_tools generation.
 */

import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import yaml from 'js-yaml';
import type { SkillService } from './SkillService';
import type { McpClientManagerService } from './McpClientManagerService';
import type {
  CachedFileSkillInfo,
  CachedPromptSkillInfo,
  CachedServerDefinition,
  DefinitionsCacheFile,
  McpPromptInfo,
  McpResourceInfo,
  McpToolInfo,
  PromptSkillConfig,
  Skill,
} from '../types';
import { extractSkillFrontMatter } from '../utils';
import { LOG_PREFIX_CAPABILITY_DISCOVERY, LOG_PREFIX_SKILL_DETECTION } from '../constants';

interface DefinitionsCacheServiceOptions {
  cacheData?: DefinitionsCacheFile;
}

interface PromptSkillMatch {
  serverName: string;
  promptName: string;
  skill: PromptSkillConfig;
  autoDetected?: boolean;
}

interface CollectOptions {
  serverId?: string;
  configPath?: string;
  configHash?: string;
  oneMcpVersion?: string;
}

function isYamlPath(filePath: string): boolean {
  return filePath.endsWith('.yaml') || filePath.endsWith('.yml');
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function sanitizeConfigPathForFilename(configFilePath: string): string {
  const absoluteConfigPath = resolve(configFilePath);
  const normalizedPath =
    absoluteConfigPath.length >= 2 &&
    absoluteConfigPath[1] === ':' &&
    ((absoluteConfigPath[0] >= 'A' && absoluteConfigPath[0] <= 'Z') ||
      (absoluteConfigPath[0] >= 'a' && absoluteConfigPath[0] <= 'z'))
      ? `${absoluteConfigPath[0].toLowerCase()}${absoluteConfigPath.slice(1)}`
      : absoluteConfigPath;

  let result = '';
  let previousWasUnderscore = false;

  for (const char of normalizedPath) {
    const isSafeCharacter =
      (char >= 'a' && char <= 'z') ||
      (char >= 'A' && char <= 'Z') ||
      (char >= '0' && char <= '9') ||
      char === '.' ||
      char === '_' ||
      char === '-';

    if (isSafeCharacter) {
      result += char;
      previousWasUnderscore = false;
      continue;
    }

    if (!previousWasUnderscore) {
      result += '_';
      previousWasUnderscore = true;
    }
  }

  let start = 0;
  let end = result.length;

  while (start < end && result[start] === '_') {
    start += 1;
  }

  while (end > start && result[end - 1] === '_') {
    end -= 1;
  }

  return result.slice(start, end);
}

function cloneCache(cache: DefinitionsCacheFile): DefinitionsCacheFile {
  return {
    ...cache,
    failures: [...(cache.failures ?? [])],
    skills: (cache.skills ?? []).map((skill) => ({ ...skill })),
    servers: Object.fromEntries(
      Object.entries(cache.servers).map(([serverName, server]) => [
        serverName,
        {
          ...server,
          tools: (server.tools ?? []).map((tool) => ({ ...tool })),
          resources: (server.resources ?? []).map((resource) => ({ ...resource })),
          prompts: (server.prompts ?? []).map((prompt) => ({
            ...prompt,
            arguments: prompt.arguments?.map((arg) => ({ ...arg })),
          })),
          promptSkills: (server.promptSkills ?? []).map((promptSkill) => ({
            ...promptSkill,
            skill: { ...promptSkill.skill },
          })),
        },
      ]),
    ),
  };
}

export class DefinitionsCacheService {
  private clientManager: McpClientManagerService;
  private skillService?: SkillService;
  private cacheData?: DefinitionsCacheFile;
  private liveDefinitionsPromise: Promise<DefinitionsCacheFile> | null = null;
  private mergedDefinitionsPromise: Promise<DefinitionsCacheFile> | null = null;

  constructor(
    clientManager: McpClientManagerService,
    skillService?: SkillService,
    options?: DefinitionsCacheServiceOptions,
  ) {
    this.clientManager = clientManager;
    this.skillService = skillService;
    this.cacheData = options?.cacheData;
  }

  static async readFromFile(filePath: string): Promise<DefinitionsCacheFile> {
    const content = await readFile(filePath, 'utf-8');
    const parsed = isYamlPath(filePath) ? yaml.load(content) : JSON.parse(content);

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Definitions cache must be an object');
    }

    const cache = parsed as DefinitionsCacheFile;
    if (cache.version !== 1 || !cache.servers) {
      throw new Error('Definitions cache is missing required fields');
    }

    return {
      ...cache,
      failures: Array.isArray(cache.failures) ? cache.failures : [],
      skills: Array.isArray(cache.skills) ? cache.skills : [],
      servers: Object.fromEntries(
        Object.entries(cache.servers).map(([serverName, server]) => [
          serverName,
          {
            ...server,
            tools: Array.isArray(server.tools) ? server.tools : [],
            resources: Array.isArray(server.resources) ? server.resources : [],
            prompts: Array.isArray(server.prompts) ? server.prompts : [],
            promptSkills: Array.isArray(server.promptSkills) ? server.promptSkills : [],
          },
        ]),
      ),
    };
  }

  static async writeToFile(filePath: string, cache: DefinitionsCacheFile): Promise<void> {
    const serialized = isYamlPath(filePath)
      ? yaml.dump(cache, { noRefs: true })
      : JSON.stringify(cache, null, 2);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, serialized, 'utf-8');
  }

  static getDefaultCachePath(configFilePath: string): string {
    const sanitizedPath = sanitizeConfigPathForFilename(configFilePath);

    return join(homedir(), '.aicode-toolkit', `${sanitizedPath}.definitions-cache.json`);
  }

  static generateConfigHash(config: unknown): string {
    return createHash('sha256').update(JSON.stringify(config)).digest('hex');
  }

  static isCacheValid(
    cache: DefinitionsCacheFile,
    options: { configHash?: string; oneMcpVersion?: string },
  ): boolean {
    if (options.configHash && cache.configHash && cache.configHash !== options.configHash) {
      return false;
    }
    if (options.oneMcpVersion && cache.oneMcpVersion && cache.oneMcpVersion !== options.oneMcpVersion) {
      return false;
    }
    return true;
  }

  static async clearFile(filePath: string): Promise<void> {
    await rm(filePath, { force: true });
  }

  clearLiveCache(): void {
    this.liveDefinitionsPromise = null;
    this.mergedDefinitionsPromise = null;
  }

  setCacheData(cacheData?: DefinitionsCacheFile): void {
    this.cacheData = cacheData;
    this.mergedDefinitionsPromise = null;
  }

  async collectForCache(options?: CollectOptions): Promise<DefinitionsCacheFile> {
    const liveDefinitions = await this.collectLiveDefinitions(options);
    this.setCacheData(liveDefinitions);
    this.liveDefinitionsPromise = Promise.resolve(cloneCache(liveDefinitions));
    return cloneCache(liveDefinitions);
  }

  async getDefinitions(): Promise<DefinitionsCacheFile> {
    if (this.mergedDefinitionsPromise) {
      return this.mergedDefinitionsPromise;
    }

    this.mergedDefinitionsPromise = (async () => {
      const clients = this.clientManager.getAllClients();

      if (!this.cacheData) {
        return this.getLiveDefinitions();
      }

      const missingServers = clients
        .map((client) => client.serverName)
        .filter((serverName) => !this.cacheData?.servers[serverName]);

      if (missingServers.length === 0) {
        return cloneCache(this.cacheData);
      }

      const liveDefinitions = await this.getLiveDefinitions();
      const merged = cloneCache(this.cacheData);
      for (const serverName of missingServers) {
        const serverDefinition = liveDefinitions.servers[serverName];
        if (serverDefinition) {
          merged.servers[serverName] = serverDefinition;
        }
      }

      const failureMap = new Map<string, string>();
      for (const failure of [...merged.failures, ...liveDefinitions.failures]) {
        failureMap.set(failure.serverName, failure.error);
      }
      merged.failures = Array.from(failureMap.entries()).map(([serverName, error]) => ({
        serverName,
        error,
      }));

      if (merged.skills.length === 0 && liveDefinitions.skills.length > 0) {
        merged.skills = liveDefinitions.skills.map((skill) => ({ ...skill }));
      }

      return merged;
    })();

    return this.mergedDefinitionsPromise;
  }

  async getServerDefinitions(): Promise<CachedServerDefinition[]> {
    const definitions = await this.getDefinitions();
    const serverOrder = this.clientManager.getKnownServerNames();

    if (serverOrder.length === 0) {
      return Object.values(definitions.servers);
    }

    return serverOrder
      .map((serverName) => definitions.servers[serverName])
      .filter((server): server is CachedServerDefinition => server !== undefined);
  }

  async getServersForTool(toolName: string): Promise<string[]> {
    const serverDefinitions = await this.getServerDefinitions();
    return serverDefinitions
      .filter((serverDefinition) => serverDefinition.tools.some((tool) => tool.name === toolName))
      .map((serverDefinition) => serverDefinition.serverName);
  }

  async getServersForResource(uri: string): Promise<string[]> {
    const serverDefinitions = await this.getServerDefinitions();
    return serverDefinitions
      .filter((serverDefinition) =>
        serverDefinition.resources.some((resource) => resource.uri === uri),
      )
      .map((serverDefinition) => serverDefinition.serverName);
  }

  async getPromptSkillByName(skillName: string): Promise<PromptSkillMatch | undefined> {
    const definitions = await this.getDefinitions();

    for (const [serverName, server] of Object.entries(definitions.servers)) {
      for (const promptSkill of server.promptSkills) {
        if (promptSkill.skill.name === skillName) {
          return {
            serverName,
            promptName: promptSkill.promptName,
            skill: promptSkill.skill,
            autoDetected: promptSkill.autoDetected,
          };
        }
      }
    }

    return undefined;
  }

  async getCachedFileSkills(): Promise<CachedFileSkillInfo[]> {
    const definitions = await this.getDefinitions();
    return definitions.skills.map((skill) => ({ ...skill }));
  }

  private async getLiveDefinitions(): Promise<DefinitionsCacheFile> {
    if (!this.liveDefinitionsPromise) {
      this.liveDefinitionsPromise = this.collectLiveDefinitions();
    }
    return this.liveDefinitionsPromise;
  }

  private async collectLiveDefinitions(options?: CollectOptions): Promise<DefinitionsCacheFile> {
    const clients = this.clientManager.getAllClients();
    const failures: DefinitionsCacheFile['failures'] = [];
    const servers: DefinitionsCacheFile['servers'] = {};

    const serverResults = await Promise.all(
      clients.map(async (client): Promise<CachedServerDefinition | null> => {
        try {
          const tools = await client.listTools();
          const resources = await this.listResourcesSafe(client);
          const prompts = await this.listPromptsSafe(client);
          const blacklist = new Set(client.toolBlacklist || []);
          const filteredTools = tools.filter((tool) => !blacklist.has(tool.name));
          const promptSkills = await this.collectPromptSkillsForClient(client, prompts);

          return {
            serverName: client.serverName,
            serverInstruction: client.serverInstruction,
            omitToolDescription: client.omitToolDescription,
            toolBlacklist: client.toolBlacklist,
            tools: filteredTools.map((tool) => ({
              name: tool.name,
              description: tool.description,
              inputSchema: tool.inputSchema,
              _meta: tool._meta,
            })),
            resources,
            prompts,
            promptSkills,
          };
        } catch (error) {
          failures.push({
            serverName: client.serverName,
            error: toErrorMessage(error),
          });
          return null;
        }
      }),
    );

    for (const serverDefinition of serverResults) {
      if (serverDefinition) {
        servers[serverDefinition.serverName] = serverDefinition;
      }
    }

    return {
      version: 1,
      oneMcpVersion: options?.oneMcpVersion,
      generatedAt: new Date().toISOString(),
      configPath: options?.configPath,
      configHash: options?.configHash,
      serverId: options?.serverId,
      servers,
      skills: await this.collectFileSkills(),
      failures,
    };
  }

  private async collectFileSkills(): Promise<CachedFileSkillInfo[]> {
    if (!this.skillService) {
      return [];
    }

    const skills = await this.skillService.getSkills();
    return skills.map((skill) => this.toCachedFileSkill(skill));
  }

  private toCachedFileSkill(skill: Skill): CachedFileSkillInfo {
    return {
      name: skill.name,
      description: skill.description,
      location: skill.location,
      basePath: skill.basePath,
    };
  }

  private async listPromptsSafe(client: {
    serverName: string;
    listPrompts(): Promise<McpPromptInfo[]>;
  }): Promise<McpPromptInfo[]> {
    try {
      const prompts = await client.listPrompts();
      return prompts.map((prompt) => ({
        name: prompt.name,
        description: prompt.description,
        arguments: prompt.arguments?.map((arg) => ({ ...arg })),
      }));
    } catch (error) {
      console.error(
        `${LOG_PREFIX_SKILL_DETECTION} Failed to list prompts from ${client.serverName}: ${toErrorMessage(error)}`,
      );
      return [];
    }
  }

  private async listResourcesSafe(client: {
    serverName: string;
    listResources(): Promise<
      Array<{ uri: string; name?: string; description?: string; mimeType?: string }>
    >;
  }): Promise<McpResourceInfo[]> {
    try {
      const resources = await client.listResources();
      return resources.map((resource) => ({
        uri: resource.uri,
        name: resource.name,
        description: resource.description,
        mimeType: resource.mimeType,
      }));
    } catch (error) {
      console.error(
        `${LOG_PREFIX_CAPABILITY_DISCOVERY} Failed to list resources from ${client.serverName}: ${toErrorMessage(error)}`,
      );
      return [];
    }
  }

  private async collectPromptSkillsForClient(
    client: {
      serverName: string;
      prompts?: Record<string, { skill?: PromptSkillConfig }>;
      getPrompt(name: string): Promise<{ messages?: Array<{ content: unknown }> }>;
    },
    prompts: McpPromptInfo[],
  ): Promise<CachedPromptSkillInfo[]> {
    const configuredPromptNames = new Set(client.prompts ? Object.keys(client.prompts) : []);
    const promptSkills: CachedPromptSkillInfo[] = [];

    if (client.prompts) {
      for (const [promptName, promptConfig] of Object.entries(client.prompts)) {
        if (promptConfig.skill) {
          promptSkills.push({
            promptName,
            skill: { ...promptConfig.skill },
          });
        }
      }
    }

    const autoDetectedSkills = await Promise.all(
      prompts.map(async (prompt): Promise<CachedPromptSkillInfo | null> => {
        if (configuredPromptNames.has(prompt.name)) {
          return null;
        }

        try {
          const promptResult = await client.getPrompt(prompt.name);
          const textContent =
            promptResult.messages
              ?.map((message) => {
                const content = message.content;
                if (typeof content === 'string') {
                  return content;
                }
                if (content && typeof content === 'object' && 'text' in content) {
                  return String((content as { text: string }).text);
                }
                return '';
              })
              .join('\n') || '';

          const skillExtraction = extractSkillFrontMatter(textContent);
          if (!skillExtraction) {
            return null;
          }

          return {
            promptName: prompt.name,
            skill: skillExtraction.skill,
            autoDetected: true,
          };
        } catch (error) {
          console.error(
            `${LOG_PREFIX_SKILL_DETECTION} Failed to fetch prompt '${prompt.name}' from ${client.serverName}: ${toErrorMessage(error)}`,
          );
          return null;
        }
      }),
    );

    for (const autoDetectedSkill of autoDetectedSkills) {
      if (autoDetectedSkill) {
        promptSkills.push(autoDetectedSkill);
      }
    }

    return promptSkills;
  }
}
