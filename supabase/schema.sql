-- Preparation schema. NOT applied to any remote project.
-- Load once into an empty development database after reviewing docs/OPERATIONS.md.
begin;
create schema if not exists nowro_private;
revoke all on schema nowro_private from public;
grant usage on schema nowro_private to authenticated;
create table public.cities(id text primary key,names jsonb not null,active boolean not null default false);
create table public.areas(id text primary key,city_id text not null references public.cities(id),names jsonb not null,latitude double precision not null check(latitude between -90 and 90),longitude double precision not null check(longitude between -180 and 180),active boolean not null default false);
create table public.profiles(user_id uuid primary key references auth.users(id) on delete cascade,language text not null default 'en' check(language in ('en','ko','ja','zh-CN','zh-TW')));
create table nowro_private.admins(user_id uuid primary key references auth.users(id) on delete cascade);
create table public.businesses(id uuid primary key default gen_random_uuid(),name text not null,verified boolean not null default false);
create table nowro_private.business_members(user_id uuid references auth.users(id) on delete cascade,business_id uuid references public.businesses(id) on delete cascade,primary key(user_id,business_id));
create table public.places(id text primary key,area_id text not null references public.areas(id),business_id uuid references public.businesses(id),korean_name text not null,korean_address text not null,latitude double precision check(latitude between -90 and 90),longitude double precision check(longitude between -180 and 180),category text not null,cost_min integer not null check(cost_min>=0),cost_max integer not null check(cost_max>=cost_min),stay_minutes integer not null check(stay_minutes between 10 and 240),reservation_required boolean not null default false,conditions jsonb not null default '{}',published boolean not null default false,sample boolean not null default true,source text not null,checked_at timestamptz);
create table public.place_translations(place_id text references public.places(id) on delete cascade,language text check(language in ('en','ko','ja','zh-CN','zh-TW')),name text not null,description text not null,source text not null,checked_at timestamptz,primary key(place_id,language));
create table public.opening_hours(id uuid primary key default gen_random_uuid(),place_id text not null references public.places(id) on delete cascade,weekday integer check(weekday between 0 and 6),exception_date date,closed boolean not null default false,open_minute integer check(open_minute between 0 and 1439),close_minute integer check(close_minute between 1 and 1440),last_entry_minute integer check(last_entry_minute between 0 and 1439),source text not null,checked_at timestamptz,check(closed or (open_minute<close_minute and last_entry_minute between open_minute and close_minute)));
create table public.place_photos(id uuid primary key default gen_random_uuid(),place_id text not null references public.places(id) on delete cascade,url text not null,credit text not null,license text not null,approved boolean not null default false);
create table public.place_proposals(id uuid primary key default gen_random_uuid(),place_id text not null references public.places(id),actor uuid not null references auth.users(id),patch jsonb not null,status text not null default 'pending' check(status in ('pending','approved','rejected')),created_at timestamptz not null default now());
create table public.trips(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,conditions jsonb not null,route_snapshot jsonb not null,expires_at timestamptz,created_at timestamptz not null default now());
create table public.trip_stops(id uuid primary key default gen_random_uuid(),trip_id uuid not null references public.trips(id) on delete cascade,place_id text not null references public.places(id),position integer not null check(position>=0),arrival timestamptz not null,departure timestamptz not null,calculation jsonb not null,unique(trip_id,position));
create table public.coupons(id text primary key,place_id text not null references public.places(id),benefit jsonb not null,terms jsonb not null,minimum_spend integer not null check(minimum_spend>=0),valid_from timestamptz not null,valid_until timestamptz not null,issue_cap integer not null check(issue_cap>0),redeem_cap integer not null check(redeem_cap>0),active boolean not null default false,approved boolean not null default false,check(valid_until>valid_from));
create table public.coupon_issues(id uuid primary key default gen_random_uuid(),coupon_id text not null references public.coupons(id),user_id uuid not null references auth.users(id) on delete cascade,status text not null default 'held' check(status in ('held','used','expired','cancelled')),created_at timestamptz not null default now(),unique(coupon_id,user_id));
create table public.coupon_redemptions(id uuid primary key default gen_random_uuid(),issue_id uuid not null unique references public.coupon_issues(id),actor uuid not null references auth.users(id),receipt_total integer not null,created_at timestamptz not null default now());
create table nowro_private.stamp_challenges(token uuid primary key default gen_random_uuid(),place_id text not null references public.places(id),expires_at timestamptz not null default now()+interval '2 minutes',claimed_by uuid references auth.users(id),created_by uuid not null references auth.users(id));
create table public.stamps(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,place_id text not null references public.places(id),created_at timestamptz not null default now(),unique(user_id,place_id));
create table public.missions(id uuid primary key default gen_random_uuid(),area_id text not null references public.areas(id),names jsonb not null,requirements jsonb not null,active boolean not null default false);
create table public.mission_progress(user_id uuid references auth.users(id) on delete cascade,mission_id uuid references public.missions(id),status text not null default 'pending',primary key(user_id,mission_id));
create table public.consents(user_id uuid references auth.users(id) on delete cascade,kind text not null,version text not null,granted boolean not null,updated_at timestamptz not null default now(),primary key(user_id,kind));
create table public.events(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,name text not null check(name in ('recommend','route_save','place_view','error')),created_at timestamptz not null default now());
create table public.reports(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),place_id text not null references public.places(id),reason text not null check(length(reason) between 3 and 500),status text not null default 'open',created_at timestamptz not null default now());
create table nowro_private.audit(id uuid primary key default gen_random_uuid(),actor uuid references auth.users(id),action text not null,entity text not null,created_at timestamptz not null default now());

-- Privileged lookups live outside exposed schemas, use fixed search paths and immutable server-owned membership.
create function nowro_private.is_admin() returns boolean language sql stable security definer set search_path='' as $$select auth.uid() is not null and exists(select 1 from nowro_private.admins where user_id=auth.uid())$$;
create function nowro_private.manages(place text) returns boolean language sql stable security definer set search_path='' as $$select auth.uid() is not null and (nowro_private.is_admin() or exists(select 1 from nowro_private.business_members m join public.businesses b on b.id=m.business_id join public.places p on p.business_id=b.id where m.user_id=auth.uid() and b.verified and p.id=place))$$;
revoke all on function nowro_private.is_admin(),nowro_private.manages(text) from public;
grant execute on function nowro_private.is_admin(),nowro_private.manages(text) to authenticated;
do $$declare tbl text;begin for tbl in select tablename from pg_tables where schemaname in ('public','nowro_private') loop
 if exists(select 1 from pg_tables where schemaname='public' and tablename=tbl) then execute format('alter table public.%I enable row level security',tbl); end if;
 if exists(select 1 from pg_tables where schemaname='nowro_private' and tablename=tbl) then execute format('alter table nowro_private.%I enable row level security',tbl); end if;
end loop;end$$;
grant select on public.cities,public.areas,public.places,public.place_translations,public.opening_hours,public.place_photos,public.coupons,public.missions to anon,authenticated;
create policy city_public on public.cities for select using(active);
create policy area_public on public.areas for select using(active);
create policy place_public on public.places for select using(published);
create policy translations_public on public.place_translations for select using(exists(select 1 from public.places p where p.id=place_id and p.published));
create policy hours_public on public.opening_hours for select using(exists(select 1 from public.places p where p.id=place_id and p.published));
create policy photos_public on public.place_photos for select using(approved and exists(select 1 from public.places p where p.id=place_id and p.published));
create policy coupons_public on public.coupons for select using(active and approved and exists(select 1 from public.places p where p.id=place_id and p.published));
create policy missions_public on public.missions for select using(active);
grant select,insert,update,delete on public.profiles,public.trips,public.trip_stops,public.consents to authenticated;
create policy profiles_owner on public.profiles for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy trips_owner on public.trips for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy stops_owner on public.trip_stops for all to authenticated using(exists(select 1 from public.trips t where t.id=trip_id and t.user_id=(select auth.uid()))) with check(exists(select 1 from public.trips t where t.id=trip_id and t.user_id=(select auth.uid())));
create policy consents_owner on public.consents for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
grant select on public.coupon_issues,public.stamps,public.mission_progress to authenticated;
create policy coupon_issue_owner on public.coupon_issues for select to authenticated using((select auth.uid())=user_id);
create policy stamps_owner on public.stamps for select to authenticated using((select auth.uid())=user_id);
create policy mission_progress_owner on public.mission_progress for select to authenticated using((select auth.uid())=user_id);
grant select,insert on public.place_proposals to authenticated;
create policy proposal_read on public.place_proposals for select to authenticated using(nowro_private.manages(place_id));
create policy proposal_submit on public.place_proposals for insert to authenticated with check(actor=(select auth.uid()) and status='pending' and nowro_private.manages(place_id));
grant insert on public.events,public.reports to authenticated;
create policy event_consent on public.events for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.consents c where c.user_id=(select auth.uid()) and c.kind='analytics' and c.granted));
create policy report_submit on public.reports for insert to authenticated with check(user_id=(select auth.uid()) and status='open');
-- Clients cannot mutate coupon state, proofs, stamps, admin membership, public-place approval or audit.
revoke all on public.coupon_redemptions from anon,authenticated;
revoke insert,update,delete on public.coupon_issues,public.stamps,public.mission_progress from anon,authenticated;
revoke all on all tables in schema nowro_private from anon,authenticated;

create function nowro_private.issue_coupon(cid text) returns uuid language plpgsql security definer set search_path='' as $$
declare c public.coupons; iid uuid;begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;
 select * into c from public.coupons where id=cid for update;
 if not found or not c.active or not c.approved or now() not between c.valid_from and c.valid_until then raise exception 'UNAVAILABLE';end if;
 if not exists(select 1 from public.places where id=c.place_id and published) then raise exception 'UNAVAILABLE';end if;
 if exists(select 1 from public.coupon_issues where coupon_id=cid and user_id=auth.uid()) then raise exception 'ALREADY_ISSUED';end if;
 if (select count(*) from public.coupon_issues where coupon_id=cid)>=c.issue_cap then raise exception 'SOLD_OUT';end if;
 insert into public.coupon_issues(coupon_id,user_id) values(cid,auth.uid()) returning id into iid;
 insert into nowro_private.audit(actor,action,entity) values(auth.uid(),'coupon_issue',iid::text);return iid;
end$$;
create function nowro_private.redeem_coupon(iid uuid,total integer) returns void language plpgsql security definer set search_path='' as $$
declare v public.coupon_issues;c public.coupons;begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;
 select * into v from public.coupon_issues where id=iid for update;
 if not found then raise exception 'NOT_FOUND';end if;
 select * into c from public.coupons where id=v.coupon_id for update;
 if not nowro_private.manages(c.place_id) then raise exception 'FORBIDDEN';end if;
 if v.status<>'held' then raise exception 'ALREADY_REDEEMED';end if;
 if not c.active or not c.approved or now() not between c.valid_from and c.valid_until then raise exception 'UNAVAILABLE';end if;
 if total is null or total<c.minimum_spend then raise exception 'MINIMUM_SPEND';end if;
 if (select count(*) from public.coupon_redemptions r join public.coupon_issues i on i.id=r.issue_id where i.coupon_id=c.id)>=c.redeem_cap then raise exception 'REDEEM_CAP';end if;
 update public.coupon_issues set status='used' where id=iid;
 insert into public.coupon_redemptions(issue_id,actor,receipt_total) values(iid,auth.uid(),total);
 insert into nowro_private.audit(actor,action,entity) values(auth.uid(),'coupon_redeem',iid::text);
end$$;
create function nowro_private.make_stamp_challenge(pid text) returns uuid language plpgsql security definer set search_path='' as $$declare proof uuid;begin
 if auth.uid() is null or not nowro_private.manages(pid) then raise exception 'FORBIDDEN';end if;
 insert into nowro_private.stamp_challenges(place_id,created_by) values(pid,auth.uid()) returning token into proof;return proof;
end$$;
create function nowro_private.claim_stamp(proof uuid) returns uuid language plpgsql security definer set search_path='' as $$declare ch nowro_private.stamp_challenges;sid uuid;begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;
 select * into ch from nowro_private.stamp_challenges where token=proof for update;
 if not found or ch.expires_at<now() then raise exception 'EXPIRED_PROOF';end if;
 if ch.claimed_by is not null then raise exception 'REPLAY_PROOF';end if;
 if exists(select 1 from public.stamps where user_id=auth.uid() and place_id=ch.place_id) then raise exception 'ALREADY_STAMPED';end if;
 insert into public.stamps(user_id,place_id) values(auth.uid(),ch.place_id) returning id into sid;
 update nowro_private.stamp_challenges set claimed_by=auth.uid() where token=proof;
 insert into nowro_private.audit(actor,action,entity) values(auth.uid(),'stamp_claim',sid::text);return sid;
end$$;
revoke all on function nowro_private.issue_coupon(text),nowro_private.redeem_coupon(uuid,integer),nowro_private.make_stamp_challenge(text),nowro_private.claim_stamp(uuid) from public;
grant execute on function nowro_private.issue_coupon(text),nowro_private.redeem_coupon(uuid,integer),nowro_private.make_stamp_challenge(text),nowro_private.claim_stamp(uuid) to authenticated;
create function public.issue_coupon(coupon_id text) returns uuid language sql security invoker set search_path='' as $$select nowro_private.issue_coupon(coupon_id)$$;
create function public.redeem_coupon(issue_id uuid,receipt_total integer) returns void language sql security invoker set search_path='' as $$select nowro_private.redeem_coupon(issue_id,receipt_total)$$;
create function public.make_stamp_challenge(place_id text) returns uuid language sql security invoker set search_path='' as $$select nowro_private.make_stamp_challenge(place_id)$$;
create function public.claim_stamp(proof uuid) returns uuid language sql security invoker set search_path='' as $$select nowro_private.claim_stamp(proof)$$;
revoke all on function public.issue_coupon(text),public.redeem_coupon(uuid,integer),public.make_stamp_challenge(text),public.claim_stamp(uuid) from public;
grant execute on function public.issue_coupon(text),public.redeem_coupon(uuid,integer),public.make_stamp_challenge(text),public.claim_stamp(uuid) to authenticated;
create index trips_user on public.trips(user_id);
create index issues_coupon on public.coupon_issues(coupon_id);
create index places_area on public.places(area_id);
create index hours_place on public.opening_hours(place_id);
create index events_user on public.events(user_id);
commit;
