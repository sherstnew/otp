#!/usr/bin/env python3
"""First-year OTP Mania economics: evidence-based forecast plus hard cash caps.

Facts, planning assumptions and calculated ceilings are kept separate. Forecast
coin issuance is not forced to consume the entire budget envelope.
"""
from dataclasses import dataclass

COINS_PER_RUBLE = 5
BUDGETS = (30_000_000, 32_000_000, 34_000_000)
BASE_BUDGET = 32_000_000
OLD_COIN_LIABILITY_RUB = 32_000_000
RESERVE_YEARS = 3
STAFF_FLOOR = 7_000

# Case/public operating data
AUGUST_NEW_PROGRAM_USERS = 213  # program joins, not confirmed new hires
AUGUST_COIN_SHARERS = 526
AUGUST_GIFT_BUYERS = 2_054
AUGUST_GIFTS = 3_895
AUGUST_CERTIFICATES = 3_154
AUGUST_OTHER_GIFTS = 735
AUGUST_MERCH = 6
COMMUNITIES = 53
COMMUNITY_ACTIVE_PARTICIPANTS = 3_100
COMMUNITY_EVENTS_PER_YEAR = 300  # latest public 2026 planning figure
RUSSIA_TURNOVER_EX_AGENTS_2024 = 0.42
ENGAGEMENT_SURVEY_RESPONSE = 0.75
ONBOARDING_SURVEY_RESPONSE = 0.40

# Proposed coin tariffs; volumes use the assumptions below.
COIN_BIRTHDAY = 1_000
COIN_SURVEY = 1_000
COIN_FIRST_LOGIN = 750
COIN_ENPS = 250  # each of two onboarding surveys
COIN_PROBATION = 2_500
COIN_PROFILE_BLOCKS = 2_000
COIN_PROFILE_PHONE_PHOTO = 1_500
COIN_TENURE = 1_500
COIN_COMMUNITY_EVENT = 1_000

# Rating cost plan; event selection remains by annual rating delta, not community quota.
DINNERS = 64
DINNER_UNIT_RUB = 20_000  # user estimate: 12-15k top's hour + 5k restaurant
CONFERENCE_SEATS = 50
CONFERENCE_PRICE_BASE_RUB = 25_000
CONFERENCE_PRICE_LOW_RUB = 16_000
CONFERENCE_PRICE_HIGH_RUB = 39_500
APPLICATIONS = 16_000
COMPLEX_APPLICATION_SHARE = 0.10
STANDARD_REVIEW_MINUTES = 25
COMPLEX_REVIEW_MINUTES = 60
REVIEW_APPLICATION_CASES = (12_000, 16_000, 20_000)
ROSSTAT_FINANCE_MONTHLY_WAGE_2025 = 124_032
EMPLOYER_CONTRIBUTIONS = 0.30
ANNUAL_HOURS_2025 = 1_972

# Conservative first-year activity assumptions
HIRING_REPLACEMENT_RATE = RUSSIA_TURNOVER_EX_AGENTS_2024
PASSES_PROBATION_RATE = 1.0  # ceiling: every modeled hire reaches this trigger
PROFILE_COMPLETION_RATE = 1.0  # ceiling for newly hired employees
COMMUNITY_PAID_ATTENDANCES_PER_ACTIVE_PERSON = 4
ANNUAL_PULSE_SURVEYS_PER_EMPLOYEE = 1

# Annual redemption capacities. Travel figures are public planning estimates.
SHEREGESH_PLACES = 10
SHEREGESH_PACKAGE_RUB = 139_900
KAMCHATKA_PLACES = 12
KAMCHATKA_PACKAGE_RUB = 178_000  # summer-autumn 2027 8-day group tour
CROWDFUNDING_CAMPAIGNS = 16
CROWDFUNDING_CAP_RUB_PER_CAMPAIGN = 100_000


@dataclass(frozen=True)
class Line:
    name: str
    events: float
    coins_per_event: float

    @property
    def coins(self) -> float:
        return self.events * self.coins_per_event


def model(budget: int = BASE_BUDGET, conference_price: int = CONFERENCE_PRICE_BASE_RUB,
          applications: int = APPLICATIONS) -> dict:
    reserve = OLD_COIN_LIABILITY_RUB / RESERVE_YEARS
    hourly_loaded_rub = (
        ROSSTAT_FINANCE_MONTHLY_WAGE_2025 * 12 * (1 + EMPLOYER_CONTRIBUTIONS)
        / ANNUAL_HOURS_2025
    )
    hiring_events = STAFF_FLOOR * HIRING_REPLACEMENT_RATE
    annual_survey_responses = STAFF_FLOOR * ENGAGEMENT_SURVEY_RESPONSE
    enps_responses = hiring_events * ONBOARDING_SURVEY_RESPONSE * 2
    community_paid_attendances = (
        COMMUNITY_ACTIVE_PARTICIPANTS * COMMUNITY_PAID_ATTENDANCES_PER_ACTIVE_PERSON
    )
    community_average_attendance = community_paid_attendances / COMMUNITY_EVENTS_PER_YEAR
    coin_lines = [
        Line("День рождения", STAFF_FLOOR, COIN_BIRTHDAY),
        Line("Ежегодный стаж", STAFF_FLOOR, COIN_TENURE),
        Line("Новый сотрудник: первый вход", hiring_events, COIN_FIRST_LOGIN),
        Line("Новый сотрудник: профиль", hiring_events * PROFILE_COMPLETION_RATE,
             COIN_PROFILE_BLOCKS + COIN_PROFILE_PHONE_PHOTO),
        Line("Новый сотрудник: два eNPS", enps_responses, COIN_ENPS),
        Line("Новый сотрудник: испытательный срок", hiring_events * PASSES_PROBATION_RATE,
             COIN_PROBATION),
        Line("Ежегодный опрос: ответы", annual_survey_responses, COIN_SURVEY),
        Line("Сообщества: оплачиваемое посещение", community_paid_attendances,
             COIN_COMMUNITY_EVENT),
    ]
    forecast_issuance = sum(line.coins for line in coin_lines)
    forecast_coin_cash = forecast_issuance / COINS_PER_RUBLE

    dinner_cost = DINNERS * DINNER_UNIT_RUB
    complex_applications = applications * COMPLEX_APPLICATION_SHARE
    standard_applications = applications - complex_applications
    review_minutes = (
        standard_applications * STANDARD_REVIEW_MINUTES
        + complex_applications * COMPLEX_REVIEW_MINUTES
    )
    review_cost = review_minutes / 60 * hourly_loaded_rub
    conference_cost = CONFERENCE_SEATS * conference_price
    rating_cost = dinner_cost + review_cost + conference_cost
    coin_cash_ceiling = budget - reserve - rating_cost
    if coin_cash_ceiling < 0:
        raise ValueError("Reserve and rating costs exceed annual budget")
    issue_ceiling = coin_cash_ceiling * COINS_PER_RUBLE
    unissued_headroom = max(0, issue_ceiling - forecast_issuance)
    capped_forecast_issuance = min(forecast_issuance, issue_ceiling)
    unfunded_forecast = max(0, forecast_issuance - issue_ceiling)

    # Derive a store planning proxy by spreading the case's annual budget midpoint
    # across the August purchase run-rate; not an observed average item price.
    gifts_annualized = AUGUST_GIFTS * 12
    buyers_annualized = AUGUST_GIFT_BUYERS * 12  # buyer-months, not unique people
    implied_gift_cost = (budget / gifts_annualized)
    store_gift_capacity = coin_cash_ceiling / implied_gift_cost
    gifts_per_buyer_month = AUGUST_GIFTS / AUGUST_GIFT_BUYERS
    store_buyer_month_capacity = store_gift_capacity / gifts_per_buyer_month
    fixed_redemptions = {
        "Шерегеш": SHEREGESH_PLACES * SHEREGESH_PACKAGE_RUB,
        "Камчатка (без авиабилетов)": KAMCHATKA_PLACES * KAMCHATKA_PACKAGE_RUB,
        "Краудфандинг": CROWDFUNDING_CAMPAIGNS * CROWDFUNDING_CAP_RUB_PER_CAMPAIGN,
    }
    store_redemption_cap = coin_cash_ceiling - sum(fixed_redemptions.values())
    if store_redemption_cap < 0:
        raise ValueError("Fixed redemption limits exceed the coin budget")
    redemption_lines = {"Магазин / сертификаты": store_redemption_cap, **fixed_redemptions}
    redemption_capacity = sum(redemption_lines.values())

    return {
        "budget": budget,
        "reserve": reserve,
        "rating_cost": rating_cost,
        "dinner_cost": dinner_cost,
        "review_cost": review_cost,
        "conference_cost": conference_cost,
        "hourly_loaded_rub": hourly_loaded_rub,
        "applications": applications,
        "review_minutes": review_minutes,
        "standard_applications": standard_applications,
        "complex_applications": complex_applications,
        "hiring_events": hiring_events,
        "coin_lines": coin_lines,
        "community_average_attendance": community_average_attendance,
        "forecast_issuance": forecast_issuance,
        "forecast_coin_cash": forecast_coin_cash,
        "coin_cash_ceiling": coin_cash_ceiling,
        "issue_ceiling": issue_ceiling,
        "unissued_headroom": unissued_headroom,
        "capped_forecast_issuance": capped_forecast_issuance,
        "unfunded_forecast": unfunded_forecast,
        "gifts_annualized": gifts_annualized,
        "buyers_annualized": buyers_annualized,
        "implied_gift_cost": implied_gift_cost,
        "store_gift_capacity": store_gift_capacity,
        "store_buyer_month_capacity": store_buyer_month_capacity,
        "redemption_lines": redemption_lines,
        "redemption_capacity": redemption_capacity,
        "budget_reconciliation": reserve + rating_cost + coin_cash_ceiling,
    }


def main() -> None:
    print("Проверки заявок | смета рейтинга | остаток на коины | выпускной предел | не обеспечено")
    for applications in REVIEW_APPLICATION_CASES:
        m_case = model(applications=applications)
        print(f"{applications:,.0f} | {m_case['rating_cost']:,.0f} ₽ | "
              f"{m_case['coin_cash_ceiling']:,.0f} ₽ | {m_case['issue_ceiling']:,.0f} | "
              f"{m_case['unfunded_forecast']:,.0f}")
    print("\nБюджетные сценарии | пул | резерв | рейтинг | coin-бюджет | потолок выпуска")
    for budget in BUDGETS:
        m = model(budget)
        print(f"{budget:,.0f} | {m['reserve']:,.0f} | {m['rating_cost']:,.0f} | "
              f"{m['coin_cash_ceiling']:,.0f} | {m['issue_ceiling']:,.0f}")
    m = model()
    print("\nПрогноз выдачи по активностям (коины)")
    for line in m["coin_lines"]:
        print(f"{line.name}: {line.events:,.0f} × {line.coins_per_event:,.0f} = {line.coins:,.0f}")
    print(f"Итого прогноз: {m['forecast_issuance']:,.0f} coins = {m['forecast_coin_cash']:,.0f} ₽")
    print(f"Неиспользованный потолок: {m['unissued_headroom']:,.0f} coins = "
          f"{m['unissued_headroom']/COINS_PER_RUBLE:,.0f} ₽")
    print(f"Среднее число оплаченных посещений на событие сообществ: "
          f"{m['community_average_attendance']:,.1f}")
    print(f"Проверки: {m['standard_applications']:,.0f} × {STANDARD_REVIEW_MINUTES} мин + "
          f"{m['complex_applications']:,.0f} × {COMPLEX_REVIEW_MINUTES} мин = "
          f"{m['review_minutes']:,.0f} мин; ставка {m['hourly_loaded_rub']:,.2f} ₽/ч; "
          f"стоимость {m['review_cost']:,.0f} ₽")
    print(f"Store proxy: {m['implied_gift_cost']:,.2f} ₽/gift; "
          f"annual capacity at ceiling: {m['store_gift_capacity']:,.0f} gifts")
    print("\nЛимиты погашения (рубли / коины)")
    for name, rub in m["redemption_lines"].items():
        print(f"{name}: {rub:,.0f} ₽ / {rub * COINS_PER_RUBLE:,.0f} coins")
    print(f"Всего: {m['redemption_capacity']:,.0f} ₽; "
          f"coin envelope: {m['coin_cash_ceiling']:,.0f} ₽")
    assert abs(m["budget_reconciliation"] - BASE_BUDGET) < 0.01
    assert m["forecast_issuance"] <= m["issue_ceiling"]
    assert m["redemption_capacity"] <= m["coin_cash_ceiling"]
    assert abs(m["issue_ceiling"] / COINS_PER_RUBLE - m["coin_cash_ceiling"]) < 0.01
    print(f"Сверка бюджета: {m['budget_reconciliation']:,.0f} ₽")


if __name__ == "__main__":
    main()
