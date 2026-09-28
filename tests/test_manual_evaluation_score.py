"""수동 평가 점수 계산의 핵심 규칙을 검사한다."""

from __future__ import annotations

import unittest

from scripts.score_manual_evaluation import build_metrics


class ManualEvaluationScoreTest(unittest.TestCase):
    def test_direct_and_indirect_are_process_related(self) -> None:
        rows = [
            {
                "평가 ID": "EV-01",
                "회사": "Example",
                "한국어 제목": "직접 기사",
                "원문 확인": "검토 완료",
                "공정 관련성": "직접",
                "자동 공정 판정": "관련",
                "자동 공정 판정 평가": "정확",
            },
            {
                "평가 ID": "EV-02",
                "회사": "Example",
                "한국어 제목": "간접 기사",
                "원문 확인": "검토 완료",
                "공정 관련성": "간접",
                "자동 공정 판정": "비관련",
                "자동 공정 판정 평가": "누락",
            },
        ]
        article_index = {
            ("example", "직접 기사"): {
                "company": "Example",
                "title": "Semiconductor manufacturing process technology",
                "title_ko": "직접 기사",
                "summary": "Mass production and yield improvement",
                "relevance": "high",
            },
            ("example", "간접 기사"): {
                "company": "Example",
                "title": "Corporate update",
                "title_ko": "간접 기사",
                "summary": "General business news",
                "relevance": "context",
            },
        }
        metrics = build_metrics(rows, article_index)
        self.assertEqual(metrics["reviewed"], 2)
        self.assertEqual(metrics["baseline_correct"], 1)
        self.assertEqual(len(metrics["compared"]), 2)

    def test_unreviewed_rows_are_excluded(self) -> None:
        rows = [
            {
                "평가 ID": "EV-01",
                "원문 확인": "미검토",
                "자동 공정 판정 평가": "정확",
            }
        ]
        metrics = build_metrics(rows, {})
        self.assertEqual(metrics["reviewed"], 0)
        self.assertEqual(metrics["process_counts"]["정확"], 0)

    def test_inconsistent_manual_evaluation_is_reported(self) -> None:
        rows = [
            {
                "평가 ID": "EV-10",
                "회사": "Example",
                "한국어 제목": "투자 기사",
                "원문 확인": "검토 완료",
                "공정 관련성": "직접",
                "자동 공정 판정": "비관련",
                "자동 공정 판정 평가": "정확",
                "오류 유형": "없음",
            }
        ]
        metrics = build_metrics(rows, {})
        self.assertEqual(metrics["inconsistent"][0]["id"], "EV-10")
        self.assertEqual(metrics["inconsistent"][0]["expected"], "누락")
        self.assertEqual(metrics["error_counts"]["없음"], 0)


if __name__ == "__main__":
    unittest.main()
