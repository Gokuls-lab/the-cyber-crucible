-- RPC to fetch random questions respecting subscription status
-- Replaces usage of fetch_unique_random_questions for random modes

CREATE OR REPLACE FUNCTION public.fetch_mode_questions(
    p_exam_id uuid,
    p_limit_count integer,
    p_user_id uuid,
    p_quiz_mode text,
    p_is_premium boolean DEFAULT false
)
RETURNS SETOF questions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT q.*
    FROM questions q
    WHERE 
        q.exam = p_exam_id
        -- Filter out premium questions for free users
        AND (q.is_premium IS FALSE OR p_is_premium IS TRUE)
    ORDER BY random()
    LIMIT p_limit_count;
END;
$$;

-- Grant access
GRANT EXECUTE ON FUNCTION public.fetch_mode_questions(uuid, integer, uuid, text, boolean) TO anon, authenticated, service_role;
