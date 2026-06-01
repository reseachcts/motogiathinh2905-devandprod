-- assignedClassId on accounts — admin sets the class a guest's newly
-- created students should drop into. NULL is allowed; if a guest has
-- no assignment, their student creates land with classId=null (legacy
-- pre-feature behaviour).

ALTER TABLE accounts ADD COLUMN assignedClassId TEXT;
