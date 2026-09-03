-- Keep campaign attribution at the organization, channel, or non-identifying
-- cohort level while allowing canonical public-resource and government routes.
ALTER TABLE public.acquisition_attribution
  DROP CONSTRAINT IF EXISTS acquisition_source_allowed;

ALTER TABLE public.acquisition_attribution
  ADD CONSTRAINT acquisition_source_allowed CHECK (
    source IN (
      'direct',
      'founder',
      'referral',
      'campus',
      'practitioner',
      'creator',
      'community',
      'producthunt',
      'linkedin',
      'x',
      'instagram',
      'newsletter',
      'reddit',
      'unicef_hub',
      'emhic',
      'lova_africa',
      'project_helping',
      'government',
      'other'
    )
  );

ALTER TABLE public.acquisition_attribution
  DROP CONSTRAINT IF EXISTS acquisition_medium_allowed;

ALTER TABLE public.acquisition_attribution
  ADD CONSTRAINT acquisition_medium_allowed CHECK (
    medium IN (
      'direct',
      'dm',
      'email',
      'organic',
      'partner',
      'referral',
      'social',
      'qr',
      'newsletter',
      'resource_directory',
      'partnership',
      'reply',
      'other'
    )
  );

ALTER TABLE public.acquisition_attribution
  DROP CONSTRAINT IF EXISTS acquisition_content_allowed;

ALTER TABLE public.acquisition_attribution
  ADD CONSTRAINT acquisition_content_allowed CHECK (
    content IN (
      'unspecified',
      'founder_note',
      'student_group',
      'practitioner_intro',
      'creator_demo',
      'member_share',
      'launch_post',
      'qr_card',
      'algoma_student_success',
      'algoma_wellness_coordinator',
      'bcit_student_life',
      'carleton_student_affairs',
      'cbu_student_experience',
      'concordia_cu_wellness',
      'dalhousie_be_well',
      'guelph_wellness_education',
      'lakehead_student_success',
      'laurier_wellness',
      'manitoba_student_wellness',
      'mcgill_student_services',
      'memorial_student_wellness',
      'queens_health_promotion',
      'sfu_health_promotion',
      'sfu_health_promotion_reroute',
      'trent_student_affairs',
      'ualberta_wellness_supports',
      'ubc_wellbeing',
      'ucalgary_campus_wellbeing',
      'ulethbridge_wellness_outreach',
      'unb_student_affairs',
      'uottawa_peer_wellness',
      'upei_student_experience',
      'uregina_student_wellness',
      'usask_peer_health',
      'uvic_student_life_reroute',
      'uvic_wellness_promotion',
      'uwinnipeg_student_wellness',
      'waterloo_health_promotion',
      'western_wellness',
      'windsor_student_experience',
      'lvct_health',
      'csvr',
      'camfed',
      'ird_global',
      'aku_brain_mind',
      'stand_out_mental_health',
      'jakes_gerwel_fellowship',
      'refugee_consortium_kenya',
      'chiromo_hospital_group',
      'iosapps_app_shelf_august_2026',
      'therapists_monthly_promo_august_2026',
      'adolescent_mental_health_hub',
      'digital_mental_health_directory',
      'african_youth_wellness',
      'community_request',
      -- Retain the previous token for stored attribution compatibility only.
      'explicit_tool_request',
      'mental_health_tools_directory',
      'public_health_pilot',
      'other'
    )
  );
