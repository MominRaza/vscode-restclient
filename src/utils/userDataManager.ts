import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import { HistoricalHttpRequest } from '../models/httpRequest';
import { JsonFileUtility } from './jsonFileUtility';

const restClientDir = 'rest-client';
const rootPath = process.env.VSC_REST_CLIENT_HOME !== undefined
    ? process.env.VSC_REST_CLIENT_HOME
    : path.join(os.homedir(), `.${restClientDir}`);

function getCachePath(): string {
    if (fs.existsSync(rootPath)) {
        return rootPath;
    }

    if (process.env.XDG_CACHE_HOME !== undefined) {
        return path.join(process.env.XDG_CACHE_HOME, restClientDir);
    }

    return rootPath;
}

function getStatePath(): string {
    if (fs.existsSync(rootPath)) {
        return rootPath;
    }

    if (process.env.XDG_STATE_HOME !== undefined) {
        return path.join(process.env.XDG_STATE_HOME, restClientDir);
    }

    return rootPath;
}

export class UserDataManager {

    private static readonly historyItemsMaxCount = 50;

    private static readonly cachePath: string = getCachePath();
    private static readonly statePath: string = getStatePath();

    public static get cookieFilePath() {
        return path.join(this.cachePath, 'cookie.json');
    }

    private static get historyFilePath() {
        return path.join(this.cachePath, 'history.json');
    }

    private static get environmentFilePath() {
        return path.join(this.statePath, 'environment.json');
    }

    private static get responseSaveFolderPath() {
        return path.join(this.cachePath, 'responses/raw');
    }

    private static get responseBodySaveFolderPath() {
        return path.join(this.cachePath, 'responses/body');
    }

    public static async initialize(): Promise<void> {
        await Promise.all([
            fs.ensureFile(this.historyFilePath),
            fs.ensureFile(this.cookieFilePath),
            fs.ensureFile(this.environmentFilePath),
            fs.ensureDir(this.responseSaveFolderPath),
            fs.ensureDir(this.responseBodySaveFolderPath)
        ]);
    }

    public static async addToRequestHistory(request: HistoricalHttpRequest) {
        const requests = await JsonFileUtility.deserializeFromFile<HistoricalHttpRequest[]>(this.historyFilePath, []);
        requests.unshift(request);
        await JsonFileUtility.serializeToFile(this.historyFilePath, requests.slice(0, this.historyItemsMaxCount));
    }

    public static clearRequestHistory(): Promise<void> {
        return JsonFileUtility.serializeToFile(this.historyFilePath, []);
    }

    public static getRequestHistory(): Promise<HistoricalHttpRequest[]> {
        return JsonFileUtility.deserializeFromFile(this.historyFilePath, []);
    }

    public static getEnvironment() {
        return this.getEnvironmentData().then(data => data.selectedEnvironment);
    }

    public static setEnvironment(item: unknown) {
        return this.getEnvironmentData().then(data => JsonFileUtility.serializeToFile(this.environmentFilePath, {
            selectedEnvironment: item,
            sharedEnvironmentVariables: data.sharedEnvironmentVariables
        }));
    }

    public static async getSharedEnvironmentVariables(): Promise<{ [key: string]: string }> {
        const data = await this.getEnvironmentData();
        return data.sharedEnvironmentVariables;
    }

    public static async setSharedEnvironmentVariable(name: string, value: string): Promise<void> {
        const data = await this.getEnvironmentData();
        data.sharedEnvironmentVariables[name] = value;
        await JsonFileUtility.serializeToFile(this.environmentFilePath, data);
    }

    public static getResponseSaveFilePath(fileName: string) {
        return path.join(this.responseSaveFolderPath, fileName);
    }

    public static getResponseBodySaveFilePath(fileName: string) {
        return path.join(this.responseBodySaveFolderPath, fileName);
    }

    private static async getEnvironmentData(): Promise<{ selectedEnvironment: unknown, sharedEnvironmentVariables: { [key: string]: string } }> {
        const environment = await JsonFileUtility.deserializeFromFile(this.environmentFilePath);
        if (environment
            && typeof environment === 'object'
            && 'sharedEnvironmentVariables' in environment) {
            const obj = environment as { selectedEnvironment?: unknown, sharedEnvironmentVariables?: { [key: string]: string } };
            return {
                selectedEnvironment: obj.selectedEnvironment,
                sharedEnvironmentVariables: obj.sharedEnvironmentVariables || {}
            };
        }

        return {
            selectedEnvironment: environment,
            sharedEnvironmentVariables: {}
        };
    }
}
