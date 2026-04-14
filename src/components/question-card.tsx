"use client";

import { useState } from "react";

interface Question {
  id: string;
  questionText: string;
  questionType: string;
  options: string | null;
  priority: string;
  context: string | null;
  status: string;
}

interface Props {
  question: Question;
  onAnswered: () => void;
}

const PRIORITY_STYLES: Record<string, string> = {
  critical: "border-l-red-500",
  important: "border-l-orange-400",
  nice_to_have: "border-l-gray-300",
};

export function QuestionCard({ question, onAnswered }: Props) {
  const [answer, setAnswer] = useState("");
  const [selectedOption, setSelectedOption] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const options: string[] = question.options ? JSON.parse(question.options) : [];
  const isChoice = question.questionType === "single_choice" || question.questionType === "yes_no";
  const isMulti = question.questionType === "multiple_choice";

  async function handleSubmit() {
    const value = isChoice || isMulti ? selectedOption : answer;
    if (!value) return;
    setSubmitting(true);

    await fetch(`/api/questions/${question.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer: value }),
    });

    setSubmitting(false);
    onAnswered();
  }

  return (
    <div className={`border-l-4 ${PRIORITY_STYLES[question.priority] ?? ""} bg-gray-50 rounded-r-lg p-4`}>
      {question.context && (
        <p className="text-xs text-gray-500 mb-2">{question.context}</p>
      )}
      <p className="font-medium text-gray-900 mb-3">{question.questionText}</p>

      {isChoice && options.length > 0 && (
        <div className="space-y-2 mb-3">
          {options.map(opt => (
            <label key={opt} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name={question.id}
                value={opt}
                checked={selectedOption === opt}
                onChange={() => setSelectedOption(opt)}
                className="accent-blue-600"
              />
              <span className="text-sm text-gray-700">{opt}</span>
            </label>
          ))}
        </div>
      )}

      {isMulti && options.length > 0 && (
        <div className="space-y-2 mb-3">
          {options.map(opt => (
            <label key={opt} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                value={opt}
                onChange={e => {
                  const current = selectedOption ? selectedOption.split(",") : [];
                  if (e.target.checked) current.push(opt);
                  else {
                    const idx = current.indexOf(opt);
                    if (idx >= 0) current.splice(idx, 1);
                  }
                  setSelectedOption(current.join(","));
                }}
                className="accent-blue-600"
              />
              <span className="text-sm text-gray-700">{opt}</span>
            </label>
          ))}
        </div>
      )}

      {question.questionType === "free_text" && (
        <textarea
          value={answer}
          onChange={e => setAnswer(e.target.value)}
          rows={2}
          placeholder="回答を入力してください"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      )}

      <button
        onClick={handleSubmit}
        disabled={submitting || (!answer && !selectedOption)}
        className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
      >
        {submitting ? "送信中..." : "回答する"}
      </button>
    </div>
  );
}
