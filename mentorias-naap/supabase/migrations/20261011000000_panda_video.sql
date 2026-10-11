-- =============================================================================
-- Troca o YouTube pelo Panda Video: cada vídeo passa a guardar o link de
-- incorporação (embed) do Panda, por exemplo
--   https://player-vz-xxxxxxxx-xxx.tv.pandavideo.com.br/embed/?v=<id-do-video>
-- Pode ser executado mais de uma vez.
-- =============================================================================
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'videos' and column_name = 'youtube_id'
  ) then
    alter table public.videos rename column youtube_id to video_url;
  end if;
end $$;
