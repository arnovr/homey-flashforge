// src/utils/logUtils.ts

export class ConsoleLogUtils {
    static async withoutConsoleLog<T>(fn: () => Promise<T>): Promise<T> {
        const originalLog = console.log;
        console.log = () => { };
        try {
            return await fn();
        } finally {
            console.log = originalLog;
        }
    }

    static withoutConsoleLogSync<T>(fn: () => T): T {
        const originalLog = console.log;
        console.log = () => { };
        try {
            return fn();
        } finally {
            console.log = originalLog;
        }
    }
}
