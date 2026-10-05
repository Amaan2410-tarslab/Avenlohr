-- Add an explicit suspension state for controlled administrative account moderation.
alter type public.profile_status add value if not exists 'suspended';
