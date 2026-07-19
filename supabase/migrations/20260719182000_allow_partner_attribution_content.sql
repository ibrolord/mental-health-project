-- Partner labels are organization-level campaign identifiers. The closed list
-- prevents arbitrary or user-identifying values from entering attribution.
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
      'other'
    )
  );
