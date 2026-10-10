export function getHistoryGroup(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const historyDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const daysAgo = Math.round((today.getTime() - historyDay.getTime()) / 86_400_000);
    if (daysAgo <= 0) return 'Today';
    if (daysAgo === 1) return 'Yesterday';
    if (daysAgo <= 3) return 'Previous 3 days';
    if (daysAgo <= 7) return 'Previous 7 days';
    return 'Older';
}