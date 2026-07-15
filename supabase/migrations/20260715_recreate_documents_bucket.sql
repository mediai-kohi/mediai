-- documents 버킷이 삭제되어 복구. 기존 PDF blob은 함께 유실되어 자동 복구되지 않음 (재업로드 필요).
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT DO NOTHING;
