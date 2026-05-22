export const DEBUG_MODE = true;

const renderCounts: Record<string, number> = {};

export function logRender(componentName: string) {
    if (!DEBUG_MODE) return;
    renderCounts[componentName] = (renderCounts[componentName] || 0) + 1;
    console.log(`[RENDER] ${componentName} - Count: ${renderCounts[componentName]}`);
}

export function logApi(url: string, method: string = 'GET', status?: string) {
    if (!DEBUG_MODE) return;
    console.log(`[FETCH] ${method} ${url} ${status || ''}`);
}

export function logRoute(path: string) {
    if (!DEBUG_MODE) return;
    console.log(`[ROUTE] Navigating to: ${path}`);
}

export function logEffect(effectName: string) {
    if (!DEBUG_MODE) return;
    console.log(`[EFFECT] ${effectName} triggered`);
}

export function logAbort(url: string) {
    if (!DEBUG_MODE) return;
    console.log(`[ABORT] Request to ${url} aborted`);
}

export function logLoop(message: string) {
    if (!DEBUG_MODE) return;
    console.warn(`[LOOP DETECTED] ${message}`);
}
