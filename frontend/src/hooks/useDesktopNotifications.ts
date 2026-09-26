import { useEffect, useRef } from "react";

type AnyObj = Record<string, any>;

const toDate = (raw: string): Date | null => {
  if (!raw) return null;
  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
};

const normalizeWeeks = (input: any): number[] => {
  if (Array.isArray(input)) return input.map(Number).filter((n) => !Number.isNaN(n));
  if (typeof input === "number") return [input];
  if (typeof input === "string") {
    if (input.includes("-")) {
      const [s, e] = input.split("-").map(Number);
      if (!Number.isNaN(s) && !Number.isNaN(e) && e >= s) {
        const arr: number[] = [];
        for (let i = s; i <= e; i += 1) arr.push(i);
        return arr;
      }
    }
    if (input.includes(",")) return input.split(",").map(Number).filter((n) => !Number.isNaN(n));
    const n = Number(input);
    return Number.isNaN(n) ? [] : [n];
  }
  return [];
};

export const useDesktopNotifications = (enabled: boolean) => {
  const sentRef = useRef<Set<string>>(new Set());
  const dayRef = useRef<string>("");
  const runningRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const check = async () => {
      if (runningRef.current) return;
      runningRef.current = true;
      try {
        const bridge = (window as any).pyBridge;
        if (!bridge?.get_global_settings || !bridge?.send_desktop_notification) return;

        const settingsRaw = await bridge.get_global_settings();
        const settingsPayload = JSON.parse(settingsRaw as string);
        const settings: AnyObj = settingsPayload?.data ?? settingsPayload;
        if (!settings?.enable_notifications) return;

        const now = new Date();
        const dayKey = now.toISOString().slice(0, 10);
        if (dayRef.current !== dayKey) {
          sentRef.current.clear();
          dayRef.current = dayKey;
        }

        const playSound = (settings?.notification_sound ?? "bell") !== "none";
        const leadMinutes = Math.max(1, Math.min(120, Number(settings?.reminder_lead_minutes ?? 15)));

        // Task due reminders
        if (bridge.get_tasks_by_status) {
          const groups = await Promise.all([
            bridge.get_tasks_by_status("todo"),
            bridge.get_tasks_by_status("doing"),
          ]);
          const tasks = groups.flatMap((g: string) => {
            try {
              const payload = JSON.parse(g);
              return Array.isArray(payload?.tasks) ? payload.tasks : [];
            } catch {
              return [];
            }
          });

          for (const task of tasks) {
            const due = toDate(String(task?.deadline || ""));
            if (!due) continue;
            const diffMin = (due.getTime() - now.getTime()) / 60000;
            if (diffMin < 0 || diffMin > leadMinutes) continue;
            const key = `${dayKey}:task:${task.id || task.title}:${due.getHours()}:${due.getMinutes()}`;
            if (sentRef.current.has(key)) continue;
            sentRef.current.add(key);
            await bridge.send_desktop_notification(
              "待办即将到期",
              `${task.title || "任务"} 将在 ${Math.max(0, Math.round(diffMin))} 分钟内到期`,
              playSound,
              5000
            );
          }
        }

        // Course reminders
        if (bridge.get_courses) {
          const coursesRaw = await bridge.get_courses();
          const courses = JSON.parse(coursesRaw as string);
          if (Array.isArray(courses) && courses.length > 0) {
            const today = ((now.getDay() + 6) % 7) + 1; // Mon=1..Sun=7
            const baseWeek = Number(settings?.current_week || 1);
            const maxWeek = Number(settings?.semester_weeks || 0);
            const currentWeek = Number.isFinite(maxWeek) && maxWeek > 0
              ? Math.min(Math.max(1, baseWeek), Math.trunc(maxWeek))
              : Math.max(1, baseWeek);
            const sectionTimes = Array.isArray(settings?.section_times) ? settings.section_times : [];

            for (const c of courses) {
              const day = Number(c?.day || 0);
              if (day !== today) continue;
              const weeks = normalizeWeeks(c?.weeks ?? c?.week_list);
              if (!weeks.includes(currentWeek)) continue;
              const startIndex = Math.max(0, Number(c?.start || 1) - 1);
              const startStr = sectionTimes[startIndex]?.s;
              if (!startStr || typeof startStr !== "string" || !startStr.includes(":")) continue;

              const [hh, mm] = startStr.split(":").map(Number);
              const startAt = new Date(now);
              startAt.setHours(hh, mm, 0, 0);
              const diffMin = (startAt.getTime() - now.getTime()) / 60000;
              if (diffMin < 0 || diffMin > leadMinutes) continue;

              const key = `${dayKey}:course:${c.id || c.name}:${hh}:${mm}`;
              if (sentRef.current.has(key)) continue;
              sentRef.current.add(key);
              await bridge.send_desktop_notification(
                "课程即将开始",
                `${c.name || "课程"} 将在 ${Math.max(0, Math.round(diffMin))} 分钟后开始`,
                playSound,
                5000
              );
            }
          }
        }
      } catch (e) {
        // silent fail to avoid interrupting app runtime
      } finally {
        runningRef.current = false;
      }
    };

    check();
    const timer = window.setInterval(check, 30000);
    return () => window.clearInterval(timer);
  }, [enabled]);
};
