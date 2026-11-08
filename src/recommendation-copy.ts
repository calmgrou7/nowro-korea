export function recommendationMessage(code:string,lang:string) {
 const messages:Record<string,[string,string]>={
 planning_confirmation_required:['계획용 예상 코스 안내를 확인한 후 체크해주세요.','Please review and check the planning-estimate notice.'],
 selected_event_unconfirmed:['선택한 행사의 개최 일정이 확인되지 않았습니다. 일정을 확인하거나 다른 장소를 선택해주세요.','A selected event has no confirmed schedule. Verify the dates or choose another place.'],
 selected_place_unavailable:['선택한 장소의 최신 위치 자료가 없습니다. 해당 장소를 다시 열어 위치를 확인하거나 선택을 해제해주세요.','A selected place has no current location data. Reopen its details or remove it from your selection.'],
 selected_place_too_far:['선택한 장소가 출발점의 탐색 범위 밖입니다. 도보는 반경 3km, 대중교통·차량은 8km 내에서 찾습니다. 이동수단이나 출발 위치를 바꾸거나 먼 장소를 해제해주세요.','A selected stop is outside the search radius: 3 km for walking or 8 km for transit/car. Change transport or start point, or deselect distant stops.'],
 selected_event_outside_period:['선택한 여행 날짜가 행사 기간 밖입니다. 출발 일시를 행사 기간에 맞춰주세요.','Your travel date falls outside a selected event’s dates. Change the start date to match the event.'],
 no_area_data:['이 지역에는 아직 코스로 계산할 위치 자료가 부족합니다. 지역가이드에서 장소를 선택하거나 다른 지역을 골라주세요.','Route-ready data is not available in this district yet. Choose places from Local guides or try another district.'],
 no_nearby_places:['출발 위치 가까이에 코스용 자료가 없습니다. 출발 위치나 지역, 이동수단을 바꿔보세요.','No route-ready places are close enough to the start point. Try another start point, area or transport mode.'],
 verified_filters_unavailable:['선택한 동반자·접근성·식이 조건을 확인할 수 있는 장소가 부족합니다. 추가 여행 조건을 확인해주세요.','Too few places have verified information for your companion, accessibility or dietary filters. Review More about your trip.'],
 budget_too_low:['현재 예산보다 장소의 예상 비용 상한이 높습니다. 예산을 늘리거나 비용이 확인된 다른 장소를 선택해주세요.','The estimated venue cost exceeds your budget. Increase the budget or choose other places with confirmed costs.'],
 conditions_too_restrictive:['시간·예산·이동거리 또는 선택한 장소를 함께 만족하는 코스가 없습니다. 시간을 늘리거나 선택한 장소를 줄여 다시 계산해보세요.','No route fits all your time, budget, distance and stop requirements. Allow more time or select fewer stops.'],
 invalid_conditions:['날짜·시간·예산 등 입력값을 확인해주세요.','Check the date, available time, budget and other inputs.'],
 connection_error:['코스를 불러오지 못했습니다. 입력 조건은 유지되니 잠시 후 다시 계산해주세요.','Unable to load routes. Your preferences are kept; please try again shortly.'],
 };
 return (messages[code]||messages.conditions_too_restrictive)[lang==='ko'?0:1];
}
