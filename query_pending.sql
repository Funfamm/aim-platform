SELECT type, COUNT(*) FROM EmailQueue WHERE status = 'pending' GROUP BY type;
