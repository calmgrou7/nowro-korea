import {recommend,distance} from '../shared/engine.ts';
export function recommendationResponse(conditions,catalog) {
 const routes=recommend(conditions,catalog);
 const ids=new Set(routes.flatMap(route=>route.stops.map(stop=>stop.placeId)));
 return {routes,places:catalog.filter(p=>ids.has(p.id)),diagnostic:routes.length?null:explain(conditions,catalog),engine:'rules',routing:'conservative-estimate'};
}
function explain(c,catalog) {
 const ids=[c.requiredPlaceId,...(c.requiredPlaceIds||[])].filter(Boolean),chosen=ids.map(id=>catalog.find(p=>p.id===id&&p.published));
 if(chosen.some(p=>!p))return 'selected_place_unavailable';
 if(chosen.some(p=>!p.sample&&p.category==='event'&&!p.availableUntil))return 'selected_event_unconfirmed';
 if(chosen.some(p=>distance(c.origin,p.point)>=(c.transport==='walk'?3:8)))return 'selected_place_too_far';
 const first=new Date(Date.parse(c.startAt)+9*3600000).toISOString().slice(0,10),last=new Date(Date.parse(c.startAt)+(c.minutes+9*60)*60000).toISOString().slice(0,10);
 if(chosen.some(p=>p.availableUntil&&p.availableUntil<first||p.availableFrom&&p.availableFrom>last))return 'selected_event_outside_period';
 const area=catalog.filter(p=>p.published&&distance(c.origin,p.point)<(c.transport==='walk'?3:8));
 if(!area.length)return 'no_area_data';
 if(!c.allowPlanningEstimates&&(chosen.some(p=>p.planningEstimate)||area.every(p=>p.planningEstimate)))return 'planning_confirmation_required';
 const nearby=area.filter(p=>distance(c.origin,p.point)<(c.transport==='walk'?3:8));
 if(!nearby.length)return 'no_nearby_places';
 if(nearby.every(p=>c.children&&p.children!==true||c.accessible&&p.accessible!==true||c.diet&&!p.diet.includes(c.diet)))return 'verified_filters_unavailable';
 if(nearby.every(p=>p.costMax>c.budget))return 'budget_too_low';
 return 'conditions_too_restrictive';
}
