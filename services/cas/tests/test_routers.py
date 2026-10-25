from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


class TestVerifyWorkLines:
    def test_first_line_always_valid(self):
        response = client.post(
            "/verify-work-lines",
            json={"lines": [{"lineNo": 1, "latex": "y=x^2-4x+3"}]},
        )

        assert response.status_code == 200
        assert response.json() == {"results": [{"lineNo": 1, "isValid": True}]}

    def test_equivalent_pair_is_valid(self):
        response = client.post(
            "/verify-work-lines",
            json={
                "lines": [
                    {"lineNo": 1, "latex": "y=x^2-4x+3"},
                    {"lineNo": 2, "latex": "y=(x-2)^2-1"},
                ]
            },
        )

        assert response.status_code == 200
        assert response.json() == {
            "results": [
                {"lineNo": 1, "isValid": True},
                {"lineNo": 2, "isValid": True},
            ]
        }

    def test_non_equivalent_pair_is_invalid(self):
        response = client.post(
            "/verify-work-lines",
            json={
                "lines": [
                    {"lineNo": 1, "latex": "y=x^2-4x+3"},
                    {"lineNo": 2, "latex": "y=(x-2)^2+1"},
                ]
            },
        )

        assert response.status_code == 200
        assert response.json() == {
            "results": [
                {"lineNo": 1, "isValid": True},
                {"lineNo": 2, "isValid": False},
            ]
        }

    def test_three_lines_only_middle_break_marks_that_line_invalid(self):
        response = client.post(
            "/verify-work-lines",
            json={
                "lines": [
                    {"lineNo": 1, "latex": "y=x^2-4x+3"},
                    {"lineNo": 2, "latex": "y=(x-2)^2+1"},  # 여기서 끊김
                    {"lineNo": 3, "latex": "y=(x-2)^2+1"},  # 직전 줄과는 동치
                ]
            },
        )

        assert response.status_code == 200
        body = response.json()
        assert body["results"] == [
            {"lineNo": 1, "isValid": True},
            {"lineNo": 2, "isValid": False},
            {"lineNo": 3, "isValid": True},
        ]

    def test_unparseable_line_is_conservatively_invalid(self):
        response = client.post(
            "/verify-work-lines",
            json={
                "lines": [
                    {"lineNo": 1, "latex": "y=x^2-4x+3"},
                    {"lineNo": 2, "latex": r"\text{말이 안 되는 줄}"},
                ]
            },
        )

        assert response.status_code == 200
        assert response.json() == {
            "results": [
                {"lineNo": 1, "isValid": True},
                {"lineNo": 2, "isValid": False},
            ]
        }

    def test_unparseable_first_line_is_still_valid_by_convention(self):
        response = client.post(
            "/verify-work-lines",
            json={"lines": [{"lineNo": 1, "latex": r"\text{말이 안 되는 줄}"}]},
        )

        assert response.status_code == 200
        assert response.json() == {"results": [{"lineNo": 1, "isValid": True}]}

    def test_empty_lines_returns_empty_results(self):
        response = client.post("/verify-work-lines", json={"lines": []})

        assert response.status_code == 200
        assert response.json() == {"results": []}


class TestVerifyFinalAnswer:
    def test_equivalent_answers_verified_true(self):
        response = client.post(
            "/verify-final-answer",
            json={"problemAnswerLatex": "-1", "solutionAnswerLatex": "-1"},
        )

        assert response.status_code == 200
        assert response.json() == {"verified": True}

    def test_non_equivalent_answers_verified_false(self):
        response = client.post(
            "/verify-final-answer",
            json={"problemAnswerLatex": "-1", "solutionAnswerLatex": "2"},
        )

        assert response.status_code == 200
        assert response.json() == {"verified": False}

    def test_parse_failure_is_conservatively_verified_false(self):
        response = client.post(
            "/verify-final-answer",
            json={"problemAnswerLatex": "-1", "solutionAnswerLatex": "최솟값은 -1입니다."},
        )

        assert response.status_code == 200
        assert response.json() == {"verified": False}


class TestVerifyFinalAnswerCompositeForms:
    """순서쌍·집합·여러 해 답(`app.core.answer_forms`) 라우터 연결과 예외 안전장치."""

    def test_r3_ordered_pair_answers_verified_true(self):
        for problem, solution in [("(2, 2)", "\\[\n(2,2)\n\\]"), ("(1, 3)", "\\((1,3)\\)")]:
            response = client.post(
                "/verify-final-answer",
                json={"problemAnswerLatex": problem, "solutionAnswerLatex": solution},
            )

            assert response.status_code == 200
            assert response.json() == {"verified": True}

    def test_non_scalar_comparison_type_error_is_200_false(self):
        # `x<3`(부등식) vs `3`은 기존 `is_equivalent`에서 TypeError가 났던 실제 입력이다.
        response = client.post(
            "/verify-final-answer",
            json={"problemAnswerLatex": "x<3", "solutionAnswerLatex": "3"},
        )

        assert response.status_code == 200
        assert response.json() == {"verified": False}

    def test_unexpected_exception_in_scalar_path_is_200_false(self, monkeypatch):
        from app.routers import final_check

        def boom(*_args, **_kwargs):
            raise RuntimeError("unexpected")

        monkeypatch.setattr(final_check, "is_equivalent", boom)
        response = client.post(
            "/verify-final-answer",
            json={"problemAnswerLatex": "-1", "solutionAnswerLatex": "-1"},
        )

        assert response.status_code == 200
        assert response.json() == {"verified": False}

    def test_unexpected_exception_in_composite_path_is_200_false(self, monkeypatch):
        from app.routers import final_check

        def boom(*_args, **_kwargs):
            raise RuntimeError("unexpected")

        monkeypatch.setattr(final_check, "composite_equivalent", boom)
        response = client.post(
            "/verify-final-answer",
            json={"problemAnswerLatex": "(1,3)", "solutionAnswerLatex": "(1,3)"},
        )

        assert response.status_code == 200
        assert response.json() == {"verified": False}

    def test_unexpected_exception_in_classify_is_200_false(self, monkeypatch):
        from app.routers import final_check

        def boom(*_args, **_kwargs):
            raise RuntimeError("unexpected")

        monkeypatch.setattr(final_check, "classify_answer", boom)
        response = client.post(
            "/verify-final-answer",
            json={"problemAnswerLatex": "(1,3)", "solutionAnswerLatex": "(1,3)"},
        )

        assert response.status_code == 200
        assert response.json() == {"verified": False}
