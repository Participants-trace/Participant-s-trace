(function () {
  "use strict";

  const source = window.TAVRIDA_DASHBOARD_DATA;
  if (!source) {
    document.body.innerHTML = "<main class=\"empty-state\">Не удалось загрузить данные дашборда.</main>";
    return;
  }

  const records = source.records;
  const dictionary = source.dictionary;
  const trajectoryMap = new Map(dictionary.trajectories.map((item) => [item.id, item]));

  const state = {
    program: "all",
    direction: "all",
    region: "all",
    level: "all",
    trajectory: "all",
    year: "all",
    attribution: "all",
    evidence: "all",
    search: "",
    caseLimit: 12,
    selectedProfileId: null,
  };

  const timeOrder = [
    "До 3 месяцев включительно",
    "4–6 месяцев",
    "7–12 месяцев",
    "1–2 года",
    "Более 2 лет",
    "Пока не могу выделить отдельный заметный результат",
  ];

  const colors = ["#0f766e", "#2e69c9", "#d99416", "#d94b45", "#7755b8", "#2f8f56"];

  const $ = (selector) => document.querySelector(selector);
  const numberFormat = new Intl.NumberFormat("ru-RU");
  const decimalFormat = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  const percentFormat = new Intl.NumberFormat("ru-RU", { style: "percent", maximumFractionDigits: 0 });

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => {
      const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" };
      return map[char];
    });
  }

  function percent(part, total) {
    if (!total) return "0%";
    return percentFormat.format(part / total);
  }

  function precisePercent(value) {
    return `${decimalFormat.format(value * 100)}%`;
  }

  function signedPercent(value) {
    return `${value > 0 ? "+" : ""}${precisePercent(value)}`;
  }

  function average(values) {
    const valid = values.filter((value) => Number.isFinite(value));
    if (!valid.length) return null;
    return valid.reduce((sum, value) => sum + value, 0) / valid.length;
  }

  function counter(items) {
    const map = new Map();
    items.forEach((item) => {
      if (!item) return;
      map.set(item, (map.get(item) || 0) + 1);
    });
    return [...map.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "ru"));
  }

  function multiCounter(list, getter) {
    const map = new Map();
    list.forEach((record) => {
      getter(record).forEach((item) => {
        if (!item) return;
        map.set(item, (map.get(item) || 0) + 1);
      });
    });
    return [...map.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "ru"));
  }

  function compactLabel(label, size = 82) {
    if (!label) return "";
    return label.length > size ? `${label.slice(0, size - 1).trim()}…` : label;
  }

  function compactText(value, size, options = {}) {
    const sourceText = String(value ?? "");
    const fullText = sourceText || String(options.fallback ?? "");
    const visibleText = compactLabel(fullText, size);
    const isTruncated = visibleText !== fullText;
    const tag = options.tag || "span";
    const classNames = [options.className, isTruncated ? "has-full-text" : ""].filter(Boolean).join(" ");
    const attributes = [
      classNames ? `class="${classNames}"` : "",
      isTruncated ? `data-full-text="${escapeHtml(fullText)}"` : "",
      isTruncated && options.focusable !== false ? 'tabindex="0" aria-describedby="textTooltip"' : "",
    ]
      .filter(Boolean)
      .join(" ");
    return `<${tag}${attributes ? ` ${attributes}` : ""}>${escapeHtml(visibleText)}</${tag}>`;
  }

  function listItems(items) {
    const clean = (items || []).filter(Boolean);
    if (!clean.length) return "<p>Нет данных в анкете.</p>";
    return `<ul>${clean.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
  }

  function chips(items) {
    const clean = (items || []).filter(Boolean);
    if (!clean.length) return "<p>Нет данных в анкете.</p>";
    return `<div class="profile-chips">${clean.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>`;
  }

  function profileCard(title, content) {
    return `
      <section class="profile-card">
        <h3>${escapeHtml(title)}</h3>
        ${content}
      </section>
    `;
  }

  function textCard(title, text, answerId) {
    if (!text) return profileCard(title, "<p>Нет данных в анкете.</p>");
    const contentId = `profile-answer-${answerId}`;
    return profileCard(
      title,
      `<div class="expandable-answer" data-expandable-answer>
        <p class="expandable-answer-text" id="${contentId}">${escapeHtml(text)}</p>
        <button
          type="button"
          class="expandable-answer-toggle"
          data-expand-answer
          aria-expanded="false"
          aria-controls="${contentId}"
          hidden
        >Развернуть</button>
      </div>`,
    );
  }

  function updateExpandableAnswers() {
    document.querySelectorAll("#profileBody [data-expandable-answer]").forEach((answer) => {
      const text = answer.querySelector(".expandable-answer-text");
      const toggle = answer.querySelector("[data-expand-answer]");
      if (!text || !toggle) return;
      const expanded = answer.classList.contains("is-expanded");
      const isClipped = !expanded && text.scrollHeight > text.clientHeight + 1;
      toggle.hidden = !expanded && !isClipped;
      text.classList.toggle("has-full-text", isClipped);
      if (isClipped) {
        text.dataset.fullText = text.textContent.trim();
        text.tabIndex = 0;
        text.setAttribute("aria-describedby", "textTooltip");
      } else {
        text.removeAttribute("data-full-text");
        text.removeAttribute("tabindex");
        text.removeAttribute("aria-describedby");
      }
    });
  }

  function materialsCard(record) {
    const items = record.evidenceItems || [];
    if (!record.evidenceCount) {
      return profileCard("Материалы и подтверждения", "<p>В анкете нет приложенных файлов или ссылок.</p>");
    }
    if (!items.length) {
      return profileCard("Материалы и подтверждения", "<p>Подтверждения есть в анкете, но ссылки не удалось извлечь.</p>");
    }

    const links = items
      .map((item) => {
        const kind = item.kind === "file" ? "Файл" : "Ссылка";
        return `
          <div class="material-item">
            <div class="material-copy">
              <strong>${escapeHtml(item.label || "Материал")}</strong>
              <div class="material-meta">
                <span>${escapeHtml(kind)}</span>
                <span>${escapeHtml(item.source || "Источник не указан")}</span>
                <span>${escapeHtml(item.host || "ссылка")}</span>
                ${item.restricted ? "<span>только внутр. проверка</span>" : ""}
              </div>
            </div>
            <a class="material-action" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">Открыть</a>
          </div>
        `;
      })
      .join("");

    const hiddenNote = record.restrictedEvidenceCount
      ? `<p class="material-note">${escapeHtml(numberFormat.format(record.restrictedEvidenceCount))} материал(ов) отмечено ограничением по разрешению участника.</p>`
      : "";
    return profileCard("Материалы и подтверждения", `<div class="material-list">${links}</div>${hiddenNote}`);
  }

  function hasSearch(record) {
    if (!state.search) return true;
    const haystack = [
      record.id,
      record.displayName,
      record.region,
      record.professionalLevel,
      record.primaryActivity,
      record.additionalActivity,
      record.caseSummary,
      record.skillsSummary,
      record.futureLink,
      record.missingSummary,
      (record.evidenceItems || []).map((item) => `${item.label} ${item.source} ${item.host}`).join(" "),
      record.directions.join(" "),
      record.programs.join(" "),
      record.trajectories.map((tag) => trajectoryMap.get(tag)?.label || tag).join(" "),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(state.search.toLowerCase());
  }

  function matchesFilters(record) {
    if (state.program !== "all" && !record.programs.includes(state.program)) return false;
    if (state.direction !== "all" && !record.directions.includes(state.direction)) return false;
    if (state.region !== "all" && record.region !== state.region) return false;
    if (state.level !== "all" && record.professionalLevel !== state.level) return false;
    if (state.trajectory !== "all" && !record.trajectories.includes(state.trajectory)) return false;
    if (state.year !== "all" && !record.programYears.includes(Number(state.year))) return false;
    if (state.attribution === "positive" && !record.positiveAttribution) return false;
    if (state.attribution === "strong" && !record.strongAttribution) return false;
    if (state.attribution === "weak" && record.positiveAttribution) return false;
    if (state.evidence === "with-evidence" && record.evidenceCount === 0) return false;
    if (state.evidence === "with-interview" && record.interviewConsent !== "Да") return false;
    if (state.evidence === "public-materials" && !record.materialsAllowed) return false;
    return hasSearch(record);
  }

  function filteredRecords() {
    return records.filter(matchesFilters);
  }

  function kpiCard(title, value, subtext, tone = "teal") {
    return `
      <article class="kpi-card" data-tone="${tone}">
        <h3>${escapeHtml(title)}</h3>
        <div class="kpi-value">${escapeHtml(value)}</div>
        <p class="kpi-sub">${escapeHtml(subtext)}</p>
      </article>
    `;
  }

  function barRow(item, total, options = {}) {
    const max = options.max ?? total;
    const width = max ? Math.max(2, Math.min(100, (item.count / max) * 100)) : 0;
    const color = options.color || item.color || colors[0];
    const valueLabel = item.valueLabel || `${numberFormat.format(item.count)} · ${percent(item.count, total)}`;
    const meta = item.meta ? `<div class="impact-meta">${escapeHtml(item.meta)}</div>` : "";
    return `
      <div class="bar-row">
        <div class="row-top">
          ${compactText(item.label, options.labelSize || 92, { className: "row-label" })}
          <span class="row-value">${escapeHtml(valueLabel)}</span>
        </div>
        <div class="track" aria-hidden="true">
          <div class="fill" style="--width:${width}%; --bar-color:${color};"></div>
        </div>
        ${meta}
      </div>
    `;
  }

  function renderBarList(container, items, total, options = {}) {
    const max = options.scaleToMax ? Math.max(...items.map((item) => item.count), 1) : total;
    container.innerHTML = items.length
      ? items.map((item, index) => barRow({ ...item, color: item.color || colors[index % colors.length] }, total, { ...options, max })).join("")
      : "<div class=\"empty-state\">Нет данных для выбранного фильтра.</div>";
  }

  function renderKpis(list) {
    const total = list.length;
    const positive = list.filter((record) => record.positiveAttribution);
    const strong = list.filter((record) => record.strongAttribution);
    const timeBase = positive.filter((record) => record.timeToResult);
    const withinSix = timeBase.filter((record) =>
      ["До 3 месяцев включительно", "4–6 месяцев"].includes(record.timeToResult),
    );
    const impactAverage = average(list.map((record) => record.impactIndex).filter((value) => value !== null));
    const scores = list.map((record) => record.recommendation).filter((value) => Number.isFinite(value));
    const promoters = scores.filter((score) => score >= 9).length;
    const passives = scores.filter((score) => score >= 7 && score <= 8).length;
    const detractors = scores.filter((score) => score <= 6).length;
    const promoterShare = scores.length ? promoters / scores.length : 0;
    const passiveShare = scores.length ? passives / scores.length : 0;
    const detractorShare = scores.length ? detractors / scores.length : 0;
    const nps = promoterShare - detractorShare;
    const evidence = list.filter((record) => record.evidenceCount > 0).length;
    const interview = list.filter((record) => record.interviewConsent === "Да").length;

    $("#kpiGrid").innerHTML = [
      kpiCard("Участники", numberFormat.format(total), `из ${numberFormat.format(records.length)} ответов в выгрузке`, "blue"),
      kpiCard("Есть связь с программой", percent(positive.length, total), `${positive.length} участников, включая частичную связь`),
      kpiCard("Сильная связь", percent(strong.length, total), `${strong.length} участников видят ключевой вклад`),
      kpiCard("Результат до 6 месяцев", percent(withinSix.length, timeBase.length), `${withinSix.length} из ${timeBase.length || 0} ответов с указанным сроком`, "green"),
      kpiCard("Индекс влияния", impactAverage ? decimalFormat.format(impactAverage) : "0,00", "среднее по десяти аспектам 1–5", "teal"),
      kpiCard(
        "NPS",
        scores.length ? signedPercent(nps) : "0,00%",
        `Приверженцы ${precisePercent(promoterShare)} - критики ${precisePercent(detractorShare)}; нейтралы ${precisePercent(passiveShare)}`,
        "blue",
      ),
      kpiCard("Подтверждения", percent(evidence, total), `${evidence} участников приложили файлы или ссылки`, "amber"),
      kpiCard("Готовы к интервью", percent(interview, total), `${interview} участников можно звать на глубинное интервью`, "green"),
    ].join("");
  }

  function renderSpeed(list) {
    const base = list.filter((record) => record.timeToResult);
    const counts = new Map(counter(base.map((record) => record.timeToResult)).map((item) => [item.label, item.count]));
    const items = timeOrder
      .filter((label) => counts.has(label))
      .map((label, index) => ({ label, count: counts.get(label), color: colors[index % colors.length] }));
    renderBarList($("#speedBars"), items, base.length, { labelSize: 70 });
  }

  function impactStats(list) {
    return dictionary.impactLabels
      .map((label, index) => {
        const values = list.map((record) => record.impact[index]).filter((value) => Number.isFinite(value));
        const avg = average(values);
        const top = values.filter((value) => value >= 4).length;
        const low = values.filter((value) => value <= 2).length;
        const difficult = list.filter((record) => record.impact[index] === null).length;
        return {
          label,
          avg,
          count: values.length,
          top,
          low,
          difficult,
        };
      })
      .sort((a, b) => (b.avg || 0) - (a.avg || 0));
  }

  function renderImpact(list) {
    const stats = impactStats(list);
    $("#impactBars").innerHTML = stats.length
      ? stats
          .map((item) => {
            const width = item.avg ? Math.max(2, (item.avg / 5) * 100) : 0;
            return `
              <div class="impact-row">
                <div>
                  <div class="impact-label">${escapeHtml(item.label)}</div>
                  <div class="impact-meta">${escapeHtml(`${item.count} оценок, ${item.difficult} затруднились`)}</div>
                </div>
                <div class="track" aria-hidden="true">
                  <div class="fill" style="--width:${width}%; --bar-color:#0f766e;"></div>
                </div>
                <div class="score-pill">${item.avg ? decimalFormat.format(item.avg) : "0,00"}</div>
              </div>
            `;
          })
          .join("")
      : "<div class=\"empty-state\">Нет оценок для выбранного сегмента.</div>";
  }

  function renderTrajectories(list) {
    const total = list.length;
    const counts = new Map();
    list.forEach((record) => {
      record.trajectories.forEach((tag) => counts.set(tag, (counts.get(tag) || 0) + 1));
    });

    const items = dictionary.trajectories
      .map((trajectory) => ({ ...trajectory, count: counts.get(trajectory.id) || 0 }))
      .filter((trajectory) => trajectory.count > 0)
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "ru"));

    $("#trajectoryGrid").innerHTML = items.length
      ? items
          .map((item, index) => {
            const width = total ? Math.max(4, (item.count / total) * 100) : 0;
            const active = state.trajectory === item.id ? " is-active" : "";
            return `
              <button class="trajectory-card${active}" type="button" data-trajectory="${escapeHtml(item.id)}">
                <span class="trajectory-title">
                  <h3>${escapeHtml(item.label)}</h3>
                  <span class="trajectory-count">${numberFormat.format(item.count)}</span>
                </span>
                <p>${escapeHtml(item.description)}</p>
                <span class="trajectory-share">${escapeHtml(percent(item.count, total))} выбранного сегмента</span>
                <span class="track" aria-hidden="true">
                  <span class="fill" style="--width:${width}%; --bar-color:${colors[index % colors.length]};"></span>
                </span>
              </button>
            `;
          })
          .join("")
      : "<div class=\"empty-state\">В этом сегменте траектории не определены.</div>";

    document.querySelectorAll("[data-trajectory]").forEach((button) => {
      button.addEventListener("click", () => {
        const value = button.getAttribute("data-trajectory");
        state.trajectory = state.trajectory === value ? "all" : value;
        $("#trajectoryFilter").value = state.trajectory;
        state.caseLimit = 12;
        render();
      });
    });
  }

  function renderFactorPanels(list) {
    const factorItems = dictionary.factors.map((label) => ({
      label,
      count: list.filter((record) => record.factors.includes(label)).length,
    }));
    renderBarList(
      $("#factorBars"),
      factorItems.filter((item) => item.count > 0).sort((a, b) => b.count - a.count).slice(0, 8),
      list.length,
      { scaleToMax: true, labelSize: 72 },
    );

    const supportItems = dictionary.supportNeeds.map((label) => ({
      label,
      count: list.filter((record) => record.supportNeeds.includes(label)).length,
    }));
    renderBarList(
      $("#supportBars"),
      supportItems.filter((item) => item.count > 0).sort((a, b) => b.count - a.count),
      list.length,
      { scaleToMax: true, labelSize: 72 },
    );
  }

  function renderSegments(list) {
    renderBarList($("#segmentPrograms"), multiCounter(list, (record) => record.programs), list.length, {
      scaleToMax: true,
      labelSize: 54,
    });
    renderBarList($("#segmentDirections"), multiCounter(list, (record) => record.directions).slice(0, 10), list.length, {
      scaleToMax: true,
      labelSize: 54,
    });
    renderBarList($("#segmentRegions"), counter(list.map((record) => record.region)).slice(0, 10), list.length, {
      scaleToMax: true,
      labelSize: 54,
    });
    renderBarList($("#segmentLevels"), counter(list.map((record) => record.professionalLevel)), list.length, {
      scaleToMax: true,
      labelSize: 46,
    });
    renderBarList($("#segmentYears"), counter(list.map((record) => record.latestYear || "Не указан")).slice(0, 6), list.length, {
      scaleToMax: true,
      labelSize: 34,
    });
  }

  function permissionText(record) {
    if (record.nameAllowed && record.materialsAllowed) return "Можно имя и материалы";
    if (record.nameAllowed) return "Можно имя без материалов";
    if (record.anonymousOnly) return "Только обезличенно";
    return "Внутренний кейс";
  }

  function caseMatches(record) {
    return record.caseAllowed && (record.caseSummary || record.skillsSummary || record.futureLink);
  }

  function renderCases(list) {
    const cases = list
      .filter(caseMatches)
      .sort((a, b) => b.qualityScore - a.qualityScore || (b.impactIndex || 0) - (a.impactIndex || 0));
    const visible = cases.slice(0, state.caseLimit);

    $("#casesMeta").textContent = `${numberFormat.format(cases.length)} кейсов в выбранном сегменте, показано ${numberFormat.format(visible.length)}.`;
    $("#showMoreCases").style.display = visible.length < cases.length ? "inline-flex" : "none";

    $("#caseGrid").innerHTML = visible.length
      ? visible
          .map((record) => {
            const trajectory = trajectoryMap.get(record.primaryTrajectory)?.label || "Кейс";
            const impact = record.impactIndex ? decimalFormat.format(record.impactIndex) : "н/д";
            const evidenceLabel =
              record.evidenceCount > 0 ? `${record.evidenceCount} подтвержд.` : "без файла";
            const caseText = record.caseSummary || record.skillsSummary || record.futureLink || "";
            const fullCaseText = record.achievementItems?.join(" ") || record.skillsSummary || record.futureLink || caseText;
            const caseTextIsTruncated = caseText.endsWith("…") && fullCaseText !== caseText;
            return `
              <article class="case-card" role="button" tabindex="0" data-profile-id="${escapeHtml(record.id)}" aria-label="Открыть профиль ${escapeHtml(record.displayName || record.id)}">
                <header>
                  <div>
                    <p class="eyebrow">${escapeHtml(trajectory)}</p>
                    <h3>${escapeHtml(record.displayName || record.id)}</h3>
                  </div>
                  <span class="case-score">${escapeHtml(impact)}</span>
                </header>
                <p class="case-text${caseTextIsTruncated ? " has-full-text" : ""}"${caseTextIsTruncated ? ` data-full-text="${escapeHtml(fullCaseText)}"` : ""}>${escapeHtml(caseText)}</p>
                <div class="case-meta" aria-label="Параметры кейса">
                  <span>${escapeHtml(record.region || "Регион не указан")}</span>
                  <span>${escapeHtml(record.latestYear || "год не указан")}</span>
                  ${compactText(record.programs.join(", "), 48, { fallback: "программа не указана", focusable: false })}
                  ${compactText(record.directions.join(", "), 48, { fallback: "направление не указано", focusable: false })}
                </div>
                <div class="case-flags">
                  <span class="${record.evidenceCount > 0 ? "good" : "warn"}">${escapeHtml(evidenceLabel)}</span>
                  <span class="${record.interviewConsent === "Да" ? "good" : "warn"}">${escapeHtml(record.interviewConsent === "Да" ? "готов к интервью" : "интервью не подтверждено")}</span>
                </div>
                <div class="case-permission">
                  <span class="${record.materialsAllowed ? "good" : "warn"}">${escapeHtml(permissionText(record))}</span>
                  <span>${escapeHtml(record.timeToResult || "срок не указан")}</span>
                </div>
                <button type="button" class="profile-link" data-profile-id="${escapeHtml(record.id)}">Открыть профиль</button>
              </article>
            `;
          })
          .join("")
      : "<div class=\"empty-state\">Кейсы для выбранного сегмента не найдены.</div>";
  }

  function renderProfile(record) {
    const trajectoryLabels = record.trajectories.map((tag) => trajectoryMap.get(tag)?.label || tag);
    const impactRows = dictionary.impactLabels
      .map((label, index) => ({ label, value: record.impact[index] }))
      .filter((item) => item.value !== null)
      .map(
        (item) => `
          <div class="profile-impact-row">
            <span>${escapeHtml(item.label)}</span>
            <strong>${escapeHtml(String(item.value))}</strong>
          </div>
        `,
      )
      .join("");
    const permission = [
      permissionText(record),
      record.interviewConsent === "Да" ? "Готов к интервью" : "Интервью не подтверждено",
      record.evidenceCount ? `${record.evidenceCount} подтверждений` : "Подтверждений нет",
      record.visibleEvidenceCount ? `${record.visibleEvidenceCount} материалов можно открыть` : "",
    ];

    $("#profileBody").innerHTML = `
      <header class="profile-header">
        <div>
          <p class="eyebrow">${escapeHtml(trajectoryMap.get(record.primaryTrajectory)?.label || "Профиль участника")}</p>
          <h2 id="profileTitle">${escapeHtml(record.displayName || record.id)}</h2>
          <p class="profile-subtitle">${escapeHtml(record.region || "Регион не указан")} · ${escapeHtml(record.professionalLevel || "уровень не указан")}</p>
        </div>
        <div class="profile-stats" aria-label="Ключевые параметры профиля">
          <div class="profile-stat">
            <span>Индекс влияния</span>
            <strong>${escapeHtml(record.impactIndex ? decimalFormat.format(record.impactIndex) : "н/д")}</strong>
          </div>
          <div class="profile-stat">
            <span>Рекомендация</span>
            <strong>${escapeHtml(record.recommendation ?? "н/д")}</strong>
          </div>
          <div class="profile-stat">
            <span>Срок результата</span>
            ${compactText(record.timeToResult, 26, { fallback: "н/д", tag: "strong" })}
          </div>
          <div class="profile-stat">
            <span>Год участия</span>
            <strong>${escapeHtml(record.latestYear || "н/д")}</strong>
          </div>
        </div>
      </header>
      <div class="profile-layout">
        <div class="profile-main">
          ${profileCard("Достижения", listItems(record.achievementItems && record.achievementItems.length ? record.achievementItems : [record.caseSummary].filter(Boolean)))}
          ${materialsCard(record)}
          ${textCard("Примененные навыки", record.skillsSummary, "skills")}
          ${textCard("Публикации, выставки, выступления или победы", record.publicationsSummary, "publications")}
          ${textCard("Дальнейшая связь с Таврида.АРТ", record.futureLink, "future")}
          ${textCard("Почему рекомендует программу", record.recommendReason, "recommendation")}
        </div>
        <aside class="profile-side" aria-label="Данные профиля">
          ${profileCard("Участие", chips([...(record.programs || []), ...(record.programDetails || [])]))}
          ${profileCard("Направления", chips(record.directions))}
          ${profileCard("Занятость и сфера", chips([...(record.employment || []), record.primaryActivity, record.additionalActivity]))}
          ${profileCard("Связь успеха с программой", `<p>${escapeHtml(record.attribution || "Нет данных в анкете.")}</p>`)}
          ${profileCard("Траектории", chips(trajectoryLabels))}
          ${profileCard("Ценное в опыте", chips(record.factors))}
          ${profileCard("Нужная поддержка", chips(record.supportNeeds))}
          ${profileCard("Права и подтверждения", chips(permission))}
          ${profileCard("Оценки влияния", impactRows || "<p>Нет данных в анкете.</p>")}
        </aside>
      </div>
    `;
    requestAnimationFrame(updateExpandableAnswers);
  }

  function openProfile(recordId) {
    const record = records.find((item) => item.id === recordId);
    if (!record) return;
    state.selectedProfileId = recordId;
    renderProfile(record);
    const dialog = $(".profile-dialog");
    $("#profileModal").classList.add("is-open");
    $("#profileModal").setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    dialog.scrollTop = 0;
    dialog.focus({ preventScroll: true });
  }

  function closeProfile() {
    state.selectedProfileId = null;
    $("#profileModal").classList.remove("is-open");
    $("#profileModal").setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
  }

  function renderInsight(list) {
    if (!list.length) {
      $("#segmentInsight").textContent = "Для выбранных фильтров нет ответов. Сбросьте часть условий, чтобы увидеть картину.";
      return;
    }
    const stats = impactStats(list).filter((item) => item.avg !== null);
    const topImpact = stats[0];
    const lowImpact = stats[stats.length - 1];
    const trajectories = multiCounter(list, (record) =>
      record.trajectories.map((tag) => trajectoryMap.get(tag)?.label || tag),
    );
    const topTrajectory = trajectories[0];
    const strong = list.filter((record) => record.strongAttribution).length;
    const evidence = list.filter((record) => record.evidenceCount > 0).length;
    const text = [
      `В выбранной группе ${numberFormat.format(list.length)} участников.`,
      `Сильную или полную связь с программой видят ${percent(strong, list.length)}.`,
      topImpact
        ? `Самый сильный аспект влияния: ${topImpact.label.toLowerCase()} (${decimalFormat.format(topImpact.avg)} из 5).`
        : "",
      lowImpact
        ? `Самая осторожная зона: ${lowImpact.label.toLowerCase()} (${decimalFormat.format(lowImpact.avg)} из 5).`
        : "",
      topTrajectory
        ? `Главная траектория по открытым ответам: ${topTrajectory.label.toLowerCase()}.`
        : "",
      `${numberFormat.format(evidence)} кейсов имеют подтверждающие материалы или внешние ссылки.`,
    ].filter(Boolean);
    $("#segmentInsight").textContent = text.join(" ");
  }

  function renderStatus(list) {
    const active = [];
    if (state.program !== "all") active.push(`программа: ${state.program}`);
    if (state.direction !== "all") active.push(`направление: ${state.direction}`);
    if (state.region !== "all") active.push(`регион: ${state.region}`);
    if (state.level !== "all") active.push("уровень выбран");
    if (state.trajectory !== "all") active.push(`траектория: ${trajectoryMap.get(state.trajectory)?.label || state.trajectory}`);
    if (state.year !== "all") active.push(`год: ${state.year}`);
    if (state.attribution !== "all") active.push("фильтр влияния");
    if (state.evidence !== "all") active.push("фильтр подтверждений");
    if (state.search) active.push(`поиск: ${state.search}`);
    $("#filterStatus").textContent = active.length
      ? `${numberFormat.format(list.length)} ответов после фильтрации: ${active.join("; ")}.`
      : `${numberFormat.format(list.length)} ответов, фильтры не применены.`;
  }

  function render() {
    const list = filteredRecords();
    renderStatus(list);
    renderKpis(list);
    renderSpeed(list);
    renderInsight(list);
    renderImpact(list);
    renderTrajectories(list);
    renderFactorPanels(list);
    renderCases(list);
    renderSegments(list);
  }

  function fillSelect(id, values, label) {
    const select = $(id);
    select.innerHTML = `<option value="all">${escapeHtml(label)}</option>`;
    values.forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    });
  }

  function setupFilters() {
    fillSelect("#programFilter", dictionary.programs, "Все программы");
    fillSelect("#directionFilter", dictionary.directions, "Все направления");
    fillSelect("#regionFilter", counter(records.map((record) => record.region)).map((item) => item.label), "Все регионы");
    fillSelect("#levelFilter", counter(records.map((record) => record.professionalLevel)).map((item) => item.label), "Все уровни");
    fillSelect(
      "#trajectoryFilter",
      dictionary.trajectories.map((item) => item.label),
      "Все траектории",
    );
    const trajectorySelect = $("#trajectoryFilter");
    [...trajectorySelect.options].forEach((option) => {
      if (option.value === "all") return;
      const match = dictionary.trajectories.find((item) => item.label === option.value);
      if (match) option.value = match.id;
    });
    const years = [...new Set(records.flatMap((record) => record.programYears))]
      .filter(Boolean)
      .sort((a, b) => b - a)
      .map(String);
    fillSelect("#yearFilter", years, "Все годы");

    [
      ["programFilter", "program"],
      ["directionFilter", "direction"],
      ["regionFilter", "region"],
      ["levelFilter", "level"],
      ["trajectoryFilter", "trajectory"],
      ["yearFilter", "year"],
      ["attributionFilter", "attribution"],
      ["evidenceFilter", "evidence"],
    ].forEach(([id, key]) => {
      $(`#${id}`).addEventListener("change", (event) => {
        state[key] = event.target.value;
        state.caseLimit = 12;
        render();
      });
    });

    $("#caseSearch").addEventListener("input", (event) => {
      state.search = event.target.value.trim();
      state.caseLimit = 12;
      render();
    });

    $("#resetFilters").addEventListener("click", () => {
      Object.assign(state, {
        program: "all",
        direction: "all",
        region: "all",
        level: "all",
        trajectory: "all",
        year: "all",
        attribution: "all",
        evidence: "all",
        search: "",
        caseLimit: 12,
      });
      $("#filters").reset();
      $("#caseSearch").value = "";
      render();
    });

    $("#showMoreCases").addEventListener("click", () => {
      state.caseLimit += 12;
      render();
    });

    $("#caseGrid").addEventListener("click", (event) => {
      const target = event.target.closest("[data-profile-id]");
      if (!target) return;
      openProfile(target.getAttribute("data-profile-id"));
    });

    $("#caseGrid").addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const target = event.target.closest("[data-profile-id]");
      if (!target) return;
      event.preventDefault();
      openProfile(target.getAttribute("data-profile-id"));
    });

    document.querySelectorAll("[data-close-profile]").forEach((element) => {
      element.addEventListener("click", closeProfile);
    });

    $("#profileBody").addEventListener("click", (event) => {
      const toggle = event.target.closest("[data-expand-answer]");
      if (!toggle) return;
      const answer = toggle.closest("[data-expandable-answer]");
      const expanded = answer.classList.toggle("is-expanded");
      toggle.setAttribute("aria-expanded", String(expanded));
      toggle.textContent = expanded ? "Свернуть" : "Развернуть";
      updateExpandableAnswers();
    });

    window.addEventListener("resize", updateExpandableAnswers);

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && $("#profileModal").classList.contains("is-open")) {
        closeProfile();
      }
    });
  }

  function setupTextTooltip() {
    const tooltip = $("#textTooltip");
    if (!tooltip) return;
    let activeTarget = null;
    let hideTimer = null;

    function cancelHide() {
      if (!hideTimer) return;
      window.clearTimeout(hideTimer);
      hideTimer = null;
    }

    function positionTooltip(target) {
      const gap = 8;
      const viewportPadding = 12;
      const targetRect = target.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();
      let left = targetRect.left;
      let top = targetRect.bottom + gap;

      left = Math.max(viewportPadding, Math.min(left, window.innerWidth - tooltipRect.width - viewportPadding));
      if (top + tooltipRect.height > window.innerHeight - viewportPadding) {
        top = targetRect.top - tooltipRect.height - gap;
      }
      top = Math.max(viewportPadding, top);
      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
    }

    function showTooltip(target) {
      const fullText = target?.dataset.fullText?.trim();
      if (!fullText || window.matchMedia("(hover: none)").matches) return;
      cancelHide();
      activeTarget = target;
      tooltip.textContent = fullText;
      tooltip.setAttribute("aria-hidden", "false");
      tooltip.classList.add("is-visible");
      positionTooltip(target);
    }

    function hideTooltip(target) {
      if (target && activeTarget && target !== activeTarget) return;
      cancelHide();
      activeTarget = null;
      tooltip.classList.remove("is-visible");
      tooltip.setAttribute("aria-hidden", "true");
    }

    function scheduleHide(target) {
      cancelHide();
      hideTimer = window.setTimeout(() => hideTooltip(target), 140);
    }

    document.addEventListener("pointerover", (event) => {
      const target = event.target.closest("[data-full-text]");
      if (!target || target === activeTarget) return;
      showTooltip(target);
    });
    document.addEventListener("pointerout", (event) => {
      const target = event.target.closest("[data-full-text]");
      if (!target || target.contains(event.relatedTarget)) return;
      scheduleHide(target);
    });
    document.addEventListener("focusin", (event) => {
      const target = event.target.closest("[data-full-text]");
      if (target) showTooltip(target);
    });
    document.addEventListener("focusout", (event) => {
      const target = event.target.closest("[data-full-text]");
      if (target) hideTooltip(target);
    });
    tooltip.addEventListener("pointerenter", cancelHide);
    tooltip.addEventListener("pointerleave", () => scheduleHide(activeTarget));
    window.addEventListener("scroll", () => hideTooltip(), true);
    window.addEventListener("resize", () => hideTooltip());
  }

  function setupStaticText() {
    $("#responseBadge").textContent = `${source.meta.responses} ответ`;
    $("#periodBadge").textContent = `${source.meta.responsePeriod.from} — ${source.meta.responsePeriod.to}`;
  }

  setupStaticText();
  setupFilters();
  setupTextTooltip();
  render();
})();
