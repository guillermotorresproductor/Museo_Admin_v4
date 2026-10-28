(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  const target = root || globalThis;
  Object.keys(api).forEach((key) => { target[key] = api[key]; });
  if (typeof document !== "undefined") {
    const start = () => api.installAmericanTimeFields(document);
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
    else start();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const DEFAULT_ZONE = "America/Puerto_Rico";

  function clockFromNumbers(hour, minute) {
    if (!Number.isInteger(hour) || !Number.isInteger(minute)) return "";
    if (hour === 24) hour = 0;
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return "";
    const period = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
  }

  function partsInZone(date, timeZone) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timeZone || DEFAULT_ZONE,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    }).formatToParts(date);
    return {
      hour: Number(parts.find((part) => part.type === "hour")?.value),
      minute: Number(parts.find((part) => part.type === "minute")?.value)
    };
  }

  function formatAmericanTime(value, timeZone) {
    if (value == null || value === "") return "";
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) return "";
      const parts = partsInZone(value, timeZone);
      return clockFromNumbers(parts.hour, parts.minute);
    }
    const text = String(value).trim();
    const clock = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (clock) return clockFromNumbers(Number(clock[1]), Number(clock[2]));
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return "";
    const date = new Date(text);
    if (Number.isNaN(date.getTime())) return "";
    const parts = partsInZone(date, timeZone);
    return clockFromNumbers(parts.hour, parts.minute);
  }

  function presentAmericanClockText(value) {
    const text = String(value ?? "");
    if (!text) return text;
    const shielded = [];
    const source = text.replace(
      /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?/g,
      (match) => {
        const token = `\u0000${shielded.length}\u0000`;
        shielded.push(match);
        return token;
      }
    );
    const withMeridian = source.replace(
      /(^|[^\d:])(\d{1,2}):(\d{2})\s*(a\.?\s*m\.?|p\.?\s*m\.?)/gi,
      (match, prefix, hourText, minute, meridian) => {
        const hour = Number(hourText);
        if (hour < 1 || hour > 12) return match;
        const period = /^a/i.test(String(meridian).replace(/[\s.]/g, "")) ? "AM" : "PM";
        return `${prefix}${hour}:${minute} ${period}`;
      }
    );
    const converted = withMeridian.replace(
      /(^|[^\dT:])([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?(?!\s*[AP]M\b)/g,
      (match, prefix, hourText, minute) => {
        const formatted = clockFromNumbers(Number(hourText), Number(minute));
        return formatted ? `${prefix}${formatted}` : match;
      }
    );
    return converted.replace(/\u0000(\d+)\u0000/g, (_, index) => shielded[Number(index)]);
  }

  function displayClock(value) {
    if (value == null || value === "") return "";
    return formatAmericanTime(value) || presentAmericanClockText(value);
  }

  function timeValueTo24Hour(hour12, minute, period) {
    if (hour12 === "" || minute === "" || period === "" || hour12 == null || minute == null || period == null) return "";
    const hour = Number(hour12);
    const mins = Number(minute);
    const marker = String(period).toUpperCase();
    if (!Number.isInteger(hour) || hour < 1 || hour > 12) return "";
    if (!Number.isInteger(mins) || mins < 0 || mins > 59) return "";
    if (marker !== "AM" && marker !== "PM") return "";
    let hour24 = hour % 12;
    if (marker === "PM") hour24 += 12;
    return `${String(hour24).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
  }

  function split24(value) {
    const match = String(value || "").match(/^(\d{1,2}):(\d{2})/);
    if (!match) return null;
    const formatted = clockFromNumbers(Number(match[1]), Number(match[2]));
    if (!formatted) return null;
    const [time, period] = formatted.split(" ");
    const [hour12, minute] = time.split(":");
    return { hour12, minute, period };
  }

  function splitDateTimeLocal(value) {
    const match = String(value || "").match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
    return match ? { date: match[1], time: match[2] } : { date: "", time: "" };
  }

  function option(doc, value, label) {
    const item = doc.createElement("option");
    item.value = value;
    item.textContent = label;
    return item;
  }

  function fillSelect(select, values) {
    const doc = select.ownerDocument;
    select.append(option(doc, "", "—"));
    values.forEach((value) => select.append(option(doc, value, value)));
  }

  function enhanceAmericanTimeField(input) {
    if (!input || input.dataset.usTime === "1" || input.dataset.clockStorage === "24") return;
    if (input.type !== "time" && input.type !== "datetime-local") return;
    input.dataset.usTime = "1";
    const doc = input.ownerDocument;
    const withDate = input.type === "datetime-local";
    const host = doc.createElement("span");
    host.className = "us-time-host";
    const face = doc.createElement("span");
    face.className = withDate ? "us-time-face us-time-face-datetime" : "us-time-face";
    face.setAttribute("role", "group");
    const label = input.labels && input.labels[0] ? input.labels[0].textContent.trim() : "";
    if (label) face.setAttribute("aria-label", label);

    let dateInput = null;
    if (withDate) {
      dateInput = doc.createElement("input");
      dateInput.type = "date";
      dateInput.className = "us-time-date";
      dateInput.setAttribute("aria-label", label ? `${label}, fecha` : "Fecha");
      face.append(dateInput);
    }

    const hourSelect = doc.createElement("select");
    const minuteSelect = doc.createElement("select");
    const periodSelect = doc.createElement("select");
    hourSelect.dataset.usTimePart = "hour";
    minuteSelect.dataset.usTimePart = "minute";
    periodSelect.dataset.usTimePart = "period";
    hourSelect.setAttribute("aria-label", label ? `${label}, hora` : "Hora");
    minuteSelect.setAttribute("aria-label", label ? `${label}, minutos` : "Minutos");
    periodSelect.setAttribute("aria-label", label ? `${label}, AM o PM` : "AM o PM");
    fillSelect(hourSelect, ["12", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"]);
    fillSelect(minuteSelect, Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0")));
    fillSelect(periodSelect, ["AM", "PM"]);
    const separator = doc.createElement("span");
    separator.className = "us-time-sep";
    separator.setAttribute("aria-hidden", "true");
    separator.textContent = ":";
    face.append(hourSelect, separator, minuteSelect, periodSelect);

    let syncing = false;
    const syncFromInput = () => {
      const current = withDate ? splitDateTimeLocal(input.value) : { date: "", time: input.value };
      if (dateInput) dateInput.value = current.date;
      const parts = split24(current.time);
      hourSelect.value = parts ? parts.hour12 : "";
      minuteSelect.value = parts ? parts.minute : "";
      periodSelect.value = parts ? parts.period : "";
      const disabled = input.disabled;
      if (dateInput) dateInput.disabled = disabled;
      hourSelect.disabled = disabled;
      minuteSelect.disabled = disabled;
      periodSelect.disabled = disabled;
    };
    const writeFromFace = () => {
      if (syncing || input.disabled) return;
      const time = timeValueTo24Hour(hourSelect.value, minuteSelect.value, periodSelect.value);
      const date = dateInput ? dateInput.value : "";
      const next = withDate ? (date && time ? `${date}T${time}` : "") : time;
      syncing = true;
      input.value = next;
      syncing = false;
      const EventCtor = doc.defaultView && doc.defaultView.Event;
      if (typeof EventCtor === "function") {
        input.dispatchEvent(new EventCtor("input", { bubbles: true }));
        input.dispatchEvent(new EventCtor("change", { bubbles: true }));
      }
    };

    input.classList.add("us-time-value");
    input.setAttribute("tabindex", "-1");
    input.setAttribute("aria-hidden", "true");
    input.parentNode.insertBefore(host, input);
    host.append(face, input);
    input.usTimeSync = syncFromInput;

    const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), "value");
    if (descriptor && descriptor.set) {
      Object.defineProperty(input, "value", {
        configurable: true,
        get() { return descriptor.get.call(this); },
        set(next) {
          descriptor.set.call(this, next);
          if (!syncing) syncFromInput();
        }
      });
    }
    [dateInput, hourSelect, minuteSelect, periodSelect].filter(Boolean).forEach((control) => {
      control.addEventListener("change", writeFromFace);
      control.addEventListener("input", writeFromFace);
    });
    input.addEventListener("focus", () => hourSelect.focus());
    input.addEventListener("invalid", () => hourSelect.focus());
    if (input.form && input.form.dataset.usTimeReset !== "1") {
      input.form.dataset.usTimeReset = "1";
      input.form.addEventListener("reset", () => {
        setTimeout(() => {
          input.form.querySelectorAll("input.us-time-value").forEach((field) => {
            if (typeof field.usTimeSync === "function") field.usTimeSync();
          });
        }, 0);
      });
    }
    const Observer = doc.defaultView && doc.defaultView.MutationObserver;
    if (typeof Observer === "function") new Observer(syncFromInput).observe(input, { attributes: true, attributeFilter: ["disabled"] });
    syncFromInput();
  }

  function scanAmericanTimeFields(scope) {
    if (!scope || !scope.querySelectorAll) return;
    if (scope.matches && scope.matches('input[type="time"], input[type="datetime-local"]')) enhanceAmericanTimeField(scope);
    scope.querySelectorAll('input[type="time"], input[type="datetime-local"]').forEach(enhanceAmericanTimeField);
  }

  function installAmericanTimeFields(root) {
    const scope = root && root.querySelectorAll ? root : (typeof document !== "undefined" ? document : null);
    if (!scope) return;
    const doc = scope.ownerDocument || scope;
    scanAmericanTimeFields(scope);
    if (doc.__usTimeObserver) return;
    const target = doc.documentElement || scope;
    const Observer = doc.defaultView && doc.defaultView.MutationObserver;
    if (!target || typeof Observer !== "function") return;
    doc.__usTimeObserver = new Observer((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) scanAmericanTimeFields(node);
        });
      });
    });
    doc.__usTimeObserver.observe(target, { childList: true, subtree: true });
  }

  return {
    formatAmericanTime,
    presentAmericanClockText,
    displayClock,
    timeValueTo24Hour,
    installAmericanTimeFields
  };
});
