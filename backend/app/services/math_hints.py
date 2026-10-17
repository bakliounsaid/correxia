"""
Aide mathématique après OCR : évalue les membres droits d'égalités détectées dans la copie
pour donner au modèle de notation des indices de cohérence (ne remplace pas la vision IA).
Évaluateur restreint (arbre syntaxique) : nombres, + - * / ^, parenthèses, quelques fonctions.
"""

import ast
import math
import operator
import re

_BIN_OPS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.Pow: operator.pow,
}
_UNARY_OPS = {ast.UAdd: operator.pos, ast.USub: operator.neg}
_FUNCTIONS = {
    "sqrt": math.sqrt,
    "abs": abs,
    "log": math.log,
    "exp": math.exp,
    "sin": math.sin,
    "cos": math.cos,
    "tan": math.tan,
}
_CONSTANTS = {"pi": math.pi, "e": math.e}
_MAX_EXPR_LEN = 96
_MAX_EXPONENT = 64


def normalize_math_fragment(raw: str) -> str:
    s = raw.strip()
    if not s:
        return ""
    s = re.sub(r"[×·⨉]", "*", s).replace("÷", "/")
    s = re.sub(r"\s+", "", s)
    s = re.sub(r"π", "pi", s, flags=re.IGNORECASE)
    s = s.replace("√(", "sqrt(")
    s = re.sub(r"√(\d+(?:\.\d+)?)", r"sqrt(\1)", s)
    s = re.sub(r"(\d),(\d+)", r"\1.\2", s)
    s = re.sub(r"(\d)\(", r"\1*(", s)
    s = re.sub(r"(\))(\d)", r"\1*\2", s)
    # Multiplication implicite (« 2pi », « 3sqrt(2) ») que l'évaluateur n'accepte pas sans « * ».
    s = re.sub(r"(\d)(?=pi|sqrt|abs|log|exp|sin|cos|tan)", r"\1*", s)
    return s


def _is_plausibly_safe(expr: str) -> bool:
    if len(expr) > _MAX_EXPR_LEN:
        return False
    without_names = re.sub(r"\b(sqrt|abs|log|exp|sin|cos|tan|pi|e)\b", "", expr, flags=re.IGNORECASE)
    return re.fullmatch(r"[\d+\-*/().^]+", without_names) is not None


def _eval(node: ast.AST) -> float:
    if isinstance(node, ast.Expression):
        return _eval(node.body)
    if isinstance(node, ast.Constant) and isinstance(node.value, int | float) and not isinstance(node.value, bool):
        return float(node.value)
    if isinstance(node, ast.Name) and node.id.lower() in _CONSTANTS:
        return _CONSTANTS[node.id.lower()]
    if isinstance(node, ast.UnaryOp) and type(node.op) in _UNARY_OPS:
        return _UNARY_OPS[type(node.op)](_eval(node.operand))
    if isinstance(node, ast.BinOp) and type(node.op) in _BIN_OPS:
        left, right = _eval(node.left), _eval(node.right)
        if isinstance(node.op, ast.Pow) and abs(right) > _MAX_EXPONENT:
            raise ValueError("exposant trop grand")
        return _BIN_OPS[type(node.op)](left, right)
    if (
        isinstance(node, ast.Call)
        and isinstance(node.func, ast.Name)
        and node.func.id.lower() in _FUNCTIONS
        and len(node.args) == 1
        and not node.keywords
    ):
        return float(_FUNCTIONS[node.func.id.lower()](_eval(node.args[0])))
    raise ValueError("expression non autorisée")


def safe_evaluate(expr: str) -> float | None:
    """Valeur numérique de l'expression, ou None si non interprétable / non autorisée."""
    if not expr or not _is_plausibly_safe(expr):
        return None
    try:
        value = _eval(ast.parse(expr.replace("^", "**"), mode="eval"))
    except (SyntaxError, ValueError, TypeError, ZeroDivisionError, OverflowError, RecursionError):
        return None
    if isinstance(value, complex) or not math.isfinite(value):
        return None
    return value


def build_math_assist_hints(student_ocr: str) -> str:
    hints: list[str] = []
    for raw in student_ocr.split("\n"):
        line = raw.strip()
        if not line or line.startswith("===") or line.startswith("[Notes OCR") or "=" not in line:
            continue
        rhs = line.split("=", 1)[1].strip()
        fragment = re.split(r"[;\]]|\s{2,}", rhs)[0].strip()
        norm = normalize_math_fragment(fragment)
        value = safe_evaluate(norm)
        if value is None:
            continue
        preview = f"{line[:87]}…" if len(line) > 90 else line
        hints.append(f"« {preview} » → partie droite normalisée `{norm}` ≈ {round(value, 6):g}")
    if not hints:
        return ""
    return "\n".join(
        ["Indices mathématiques automatiques (à confronter à l’image — l’OCR peut être faux) :", *hints[:18]]
    )


def subject_uses_math_assist(subject: str) -> bool:
    return (subject or "").lower().strip() in ("math", "physics", "science")
