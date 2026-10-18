/* Motor genérico de provas — usado por todas as páginas prova*.html.
   Cada página define `const examData = {...}` e chama `renderExam(examData)`. */

(function () {
  "use strict";

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach((k) => {
        if (k === "class") node.className = attrs[k];
        else if (k === "html") node.innerHTML = attrs[k];
        else node.setAttribute(k, attrs[k]);
      });
    }
    (children || []).forEach((c) => {
      if (c) node.appendChild(c);
    });
    return node;
  }

  function text(str) {
    return document.createTextNode(str);
  }

  function totalPoints(examData) {
    return examData.questions.reduce((sum, q) => sum + q.points, 0);
  }

  function buildFigure(q) {
    if (!q.image) return null;
    const img = el("img", { src: q.image, alt: q.imageAlt || "", loading: "lazy" });
    const caption = q.imageCaption ? el("figcaption", {}, [text(q.imageCaption)]) : null;
    return el("figure", {}, [img, caption]);
  }

  function buildSingleOrMultiple(q, idx, state) {
    const isMultiple = q.type === "multiple";
    const wrap = el("div", { class: "options", "data-qidx": idx });
    q.options.forEach((optText, optIdx) => {
      const inputType = isMultiple ? "checkbox" : "radio";
      const inputAttrs = {
        type: inputType,
        name: "q" + idx,
        value: optIdx,
      };
      const input = el("input", inputAttrs);
      input.addEventListener("change", () => {
        if (!state.selections[idx]) state.selections[idx] = [];
        if (isMultiple) {
          const set = new Set(state.selections[idx]);
          if (input.checked) set.add(optIdx);
          else set.delete(optIdx);
          state.selections[idx] = Array.from(set);
        } else {
          state.selections[idx] = [optIdx];
        }
      });
      const label = el(
        "label",
        { class: "option", "data-optidx": optIdx },
        [input, el("span", { class: "option-text" }, [text(optText)])]
      );
      wrap.appendChild(label);
    });
    return wrap;
  }

  function buildTrueFalseGroup(q, idx, state) {
    const table = el("table", { class: "tf-table" });
    state.selections[idx] = state.selections[idx] || {};
    q.items.forEach((item, itemIdx) => {
      const row = el("tr", { class: "tf-row", "data-itemidx": itemIdx });
      const tdText = el("td", { class: "tf-text" }, [text(item.text)]);
      const name = "q" + idx + "-item" + itemIdx;

      const makeChoice = (value, labelText) => {
        const input = el("input", { type: "radio", name: name, value: value });
        input.addEventListener("change", () => {
          state.selections[idx][itemIdx] = value;
        });
        return el("label", {}, [input, text(" " + labelText)]);
      };

      const choices = el("div", { class: "tf-choices" }, [
        makeChoice("true", "Verdadeiro"),
        makeChoice("false", "Falso"),
      ]);
      const tdChoices = el("td", {}, [choices]);
      row.appendChild(tdText);
      row.appendChild(tdChoices);
      table.appendChild(row);
    });
    return table;
  }

  function renderQuestion(q, idx, state) {
    const card = el("div", { class: "question-card", id: "q-card-" + idx });
    const head = el("div", { class: "q-head" }, [
      el("span", { class: "q-number" }, [text("Questão " + (idx + 1))]),
      el("span", { class: "q-points" }, [text(q.points + (q.points === 1 ? " ponto" : " pontos"))]),
    ]);
    card.appendChild(head);
    card.appendChild(el("p", { class: "q-prompt" }, [text(q.prompt)]));

    const figure = buildFigure(q);
    if (figure) card.appendChild(figure);

    let body;
    if (q.type === "truefalse-group") {
      body = buildTrueFalseGroup(q, idx, state);
    } else {
      body = buildSingleOrMultiple(q, idx, state);
    }
    card.appendChild(body);

    const explanation = el("div", { class: "explanation", id: "exp-" + idx }, [
      el("div", {}, [el("strong", {}, [text("Comentário: ")]), text(q.explanation || "")]),
    ]);
    card.appendChild(explanation);

    return card;
  }

  function gradeSingleOrMultiple(q, idx, state) {
    const selected = state.selections[idx] || [];
    const correctSet = new Set(q.type === "multiple" ? q.correctIndexes : [q.correctIndex]);
    const selectedSet = new Set(selected);
    let earned = 0;
    let fullyCorrect = true;

    if (correctSet.size === selectedSet.size) {
      fullyCorrect = Array.from(correctSet).every((v) => selectedSet.has(v));
    } else {
      fullyCorrect = false;
    }
    if (fullyCorrect) earned = q.points;

    const card = document.getElementById("q-card-" + idx);
    const optionEls = card.querySelectorAll(".option");
    optionEls.forEach((optEl) => {
      const optIdx = parseInt(optEl.getAttribute("data-optidx"), 10);
      const isCorrect = correctSet.has(optIdx);
      const isSelected = selectedSet.has(optIdx);
      optEl.querySelector("input").disabled = true;
      if (isSelected) optEl.classList.add("opt-chosen");
      if (isCorrect && isSelected) optEl.classList.add("is-correct");
      else if (isCorrect && !isSelected) optEl.classList.add("is-missed");
      else if (!isCorrect && isSelected) optEl.classList.add("is-wrong");
    });

    return { earned, fullyCorrect, answered: selected.length > 0 };
  }

  function gradeTrueFalseGroup(q, idx, state) {
    const sel = state.selections[idx] || {};
    const perItem = q.points / q.items.length;
    let earned = 0;
    let answeredAny = false;
    const card = document.getElementById("q-card-" + idx);
    const rows = card.querySelectorAll(".tf-row");

    q.items.forEach((item, itemIdx) => {
      const chosen = sel[itemIdx];
      if (chosen !== undefined) answeredAny = true;
      const correctValue = item.correct ? "true" : "false";
      const isRight = chosen === correctValue;
      if (isRight) earned += perItem;

      const row = rows[itemIdx];
      row.classList.add(isRight ? "is-correct" : "is-wrong");
      row.querySelectorAll("input").forEach((inp) => {
        inp.disabled = true;
        if (inp.value === chosen) inp.closest("label").classList.add("tf-chosen");
      });
    });

    return { earned, fullyCorrect: earned >= q.points - 0.001, answered: answeredAny };
  }

  function buildExplanationText(q, result) {
    let prefix;
    if (result.fullyCorrect) prefix = "Você acertou essa questão.";
    else if (!result.answered) prefix = "Você não respondeu essa questão.";
    else prefix = "Você errou essa questão — veja abaixo o porquê.";
    return prefix + (q.explanation ? "\n\n" + q.explanation : "");
  }

  function renderExam(examData) {
    const app = document.getElementById("quiz-app");
    const state = { selections: {}, graded: false };
    const total = totalPoints(examData);

    const header = el("div", { class: "exam-header" }, [
      el("h1", {}, [text(examData.title)]),
      el("div", { class: "subject" }, [text(examData.subject)]),
      el("div", { class: "exam-progress" }, [
        text(examData.questions.length + " questões · " + total + " pontos no total"),
      ]),
    ]);
    app.appendChild(header);

    const resultBanner = el("div", { class: "result-banner", id: "result-banner" }, []);
    resultBanner.style.display = "none";
    app.appendChild(resultBanner);

    const questionsWrap = el("div", { id: "questions-wrap" }, []);
    examData.questions.forEach((q, idx) => {
      questionsWrap.appendChild(renderQuestion(q, idx, state));
    });
    app.appendChild(questionsWrap);

    const correctBtn = el("button", { class: "btn", type: "button" }, [text("Corrigir prova")]);
    const retryBtn = el("button", { class: "btn secondary", type: "button" }, [text("Tentar novamente")]);
    retryBtn.style.display = "none";

    correctBtn.addEventListener("click", () => {
      if (state.graded) return;
      state.graded = true;
      let earned = 0;

      examData.questions.forEach((q, idx) => {
        const result =
          q.type === "truefalse-group"
            ? gradeTrueFalseGroup(q, idx, state)
            : gradeSingleOrMultiple(q, idx, state);
        earned += result.earned;

        const card = document.getElementById("q-card-" + idx);
        const head = card.querySelector(".q-head");
        const badge = el(
          "span",
          { class: "q-feedback-icon " + (result.fullyCorrect ? "correct" : "wrong") },
          [text(result.fullyCorrect ? "✓ Correto" : result.answered ? "✗ Incorreto" : "— Em branco")]
        );
        head.appendChild(badge);

        const expEl = document.getElementById("exp-" + idx);
        expEl.innerHTML = "";
        expEl.appendChild(
          el("div", {}, [
            el("strong", {}, [text(result.fullyCorrect ? "Comentário: " : "Por que a resposta correta é essa: ")]),
          ])
        );
        const p = el("div", {}, [text(buildExplanationText(q, result))]);
        expEl.appendChild(p);
        expEl.classList.add("show");
      });

      const pct = total > 0 ? Math.round((earned / total) * 100) : 0;
      resultBanner.style.display = "block";
      resultBanner.innerHTML = "";
      resultBanner.appendChild(el("div", { class: "score" }, [text(earned.toFixed(1).replace(/\.0$/, "") + " / " + total)]));
      resultBanner.appendChild(el("div", { class: "score-sub" }, [text(pct + "% de aproveitamento")]));
      resultBanner.scrollIntoView({ behavior: "smooth", block: "start" });

      correctBtn.style.display = "none";
      retryBtn.style.display = "inline-block";
    });

    retryBtn.addEventListener("click", () => {
      window.location.reload();
    });

    const actions = el("div", { class: "actions-bar" }, [correctBtn, retryBtn]);
    app.appendChild(actions);
  }

  window.renderExam = renderExam;
})();
