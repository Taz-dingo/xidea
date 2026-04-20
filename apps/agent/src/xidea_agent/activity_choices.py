from __future__ import annotations

import hashlib

from xidea_agent.state import ActivityChoice, ActivityChoiceInput


def reorder_activity_choice_input(
    choice_input: ActivityChoiceInput,
    *,
    seed: str,
) -> ActivityChoiceInput:
    if len(choice_input.choices) <= 1:
        return choice_input

    ordered_choices = sorted(
        choice_input.choices,
        key=lambda choice: _choice_rank(seed, choice),
    )

    correct_indexes = [
        index for index, choice in enumerate(ordered_choices) if choice.is_correct
    ]
    if len(correct_indexes) == 1 and correct_indexes[0] == 0:
        ordered_choices = ordered_choices[1:] + ordered_choices[:1]

    return ActivityChoiceInput(type="choice", choices=ordered_choices)


def _choice_rank(seed: str, choice: ActivityChoice) -> str:
    digest = hashlib.sha256(
        f"{seed}|{choice.id}|{choice.label}|{choice.detail}".encode("utf-8")
    ).hexdigest()
    return digest
