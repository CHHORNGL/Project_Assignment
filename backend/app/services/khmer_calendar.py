import calendar
from datetime import date

try:
    from khmerdate import gregorian_to_khmer_lunar, khmer_day_of_week
except Exception:  # pragma: no cover
    gregorian_to_khmer_lunar = None
    khmer_day_of_week = {}


KHMER_WEEKDAYS = {
    0: "ច័ន្ទ",
    1: "អង្គារ",
    2: "ពុធ",
    3: "ព្រហស្បតិ៍",
    4: "សុក្រ",
    5: "សៅរ៍",
    6: "អាទិត្យ",
}


def build_khmer_calendar_month(year: int, month: int) -> dict:
    if gregorian_to_khmer_lunar is None:
        return {}

    days_in_month = calendar.monthrange(year, month)[1]
    results = {}

    for day in range(1, days_in_month + 1):
        lunar = gregorian_to_khmer_lunar(day, month, year)
        weekday_en = date(year, month, day).strftime("%A")
        weekday = khmer_day_of_week.get(weekday_en) or KHMER_WEEKDAYS.get(date(year, month, day).weekday(), "")

        lunar_day = lunar.get("lunar_day", "")
        lunar_month = lunar.get("lunar_month", "")
        zodiac_year = lunar.get("zodiac_year", "")
        stem = lunar.get("stem", "")
        lunar_year = lunar.get("lunar_year", "")

        full = f"ថ្ងៃ{weekday} {lunar_day} ខែ{lunar_month} ឆ្នាំ{zodiac_year} {stem} ព.ស. {lunar_year}".strip()

        results[f"{year:04d}-{month:02d}-{day:02d}"] = {
            "lunar_day": lunar_day,
            "lunar_month": lunar_month,
            "lunar_year": lunar_year,
            "zodiac_year": zodiac_year,
            "stem": stem,
            "weekday": weekday,
            "full": full,
        }

    return results
