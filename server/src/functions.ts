type Func =
  | string
  | {
      ident: string;
      example: string;
    };

export const globalFunctions: Func[] = [
  // ----- AEAD encryption functions -----
  "DETERMINISTIC_DECRYPT_BYTES",
  "DETERMINISTIC_DECRYPT_STRING",
  "DETERMINISTIC_ENCRYPT",

  // ----- aggregate functions -----
  {
    ident: "ANY_VALUE",
    example: `SELECT
  ANY_VALUE(i) -- 1 or 2
FROM UNNEST([1, 2]) AS i`,
  },
  {
    ident: "ARRAY_AGG",
    example: `SELECT
  ARRAY_AGG(i) -- [1, 2]
FROM UNNEST([1, 2]) AS i`,
  },
  {
    ident: "ARRAY_CONCAT_AGG",
    example: `SELECT
  -- [1, 2]
  ARRAY_CONCAT_AGG(arr)
FROM (
  SELECT [1] AS arr UNION ALL
  SELECT [2]
)`,
  },
  {
    ident: "AVG",
    example: `SELECT
  AVG(i) -- 1.5
FROM UNNEST([1, 2, NULL]) AS i`,
  },
  {
    ident: "BIT_AND",
    example: `SELECT
  BIT_AND(x), -- 0
  BIT_AND(y), -- 2
FROM UNNEST([
  STRUCT(0x0 AS x, 0x2 AS y),
        (0x1     , 0x3     ),
        (0x1     , 0x6     )
])`,
  },
  {
    ident: "BIT_OR",
    example: `SELECT
  BIT_OR(x), -- 1
  BIT_OR(y), -- 7
FROM UNNEST([
  STRUCT(0x0 AS x, 0x1 AS y),
        (0x1     , 0x2     ),
        (0x1     , 0x4     )
])`,
  },
  {
    ident: "BIT_XOR",
    example: `SELECT
  BIT_XOR(x), -- 0
  BIT_XOR(y), -- 1
  BIT_XOR(z), -- 7
FROM UNNEST([
  STRUCT(0x0 AS x, 0x0 AS y, 0x1 AS z),
        (0x1     , 0x0     , 0x2     ),
        (0x1     , 0x1     , 0x4     )
])`,
  },
  {
    ident: "COUNT",
    example: `SELECT
  COUNT(i) -- 2
FROM UNNEST([1, 2, NULL]) AS i`,
  },
  {
    ident: "COUNTIF",
    example: `SELECT
  COUNTIF(i = 1) -- 1
FROM UNNEST([1, 2]) AS i`,
  },
  {
    ident: "LOGICAL_AND",
    example: `SELECT
  LOGICAL_AND(b) -- false
FROM UNNEST([true, false]) AS b`,
  },
  {
    ident: "GROUPING",
    example: `/**
 *  one, two, one_agg
 *    1,    ,       0
 *     ,   2,       1
 */
SELECT
  one,
  two,
  GROUPING(one) one_agg,
FROM (SELECT 1 AS one, 2 AS two)
GROUP BY GROUPING SETS (one, two)`,
  },
  {
    ident: "LOGICAL_OR",
    example: `SELECT
  LOGICAL_OR(b) -- true
FROM UNNEST([true, false]) AS b`,
  },
  {
    ident: "MAX",
    example: `SELECT
  MAX(i) -- 2
FROM UNNEST([1, 2]) AS i`,
  },
  {
    ident: "MAX_BY",
    example: `SELECT
  MAX_BY(x, y) -- 3
FROM UNNEST([
  STRUCT(1 AS x, 2 AS y),
        (2     , 4     ),
        (3     , 6     )
])`,
  },
  {
    ident: "MIN",
    example: `SELECT
  MIN(i) -- 1
FROM UNNEST([1, 2]) AS i`,
  },
  {
    ident: "MIN_BY",
    example: `SELECT
  MIN_BY(x, y) -- 1
FROM UNNEST([
  STRUCT(1 AS x, 2 AS y),
        (2     , 4     ),
        (3     , 6     )
])`,
  },
  {
    ident: "STRING_AGG",
    example: `SELECT
  STRING_AGG(s), -- 'foo,bar'
  STRING_AGG(s, ''), -- 'foobar'
FROM UNNEST(['foo', 'bar']) AS s`,
  },
  {
    ident: "SUM",
    example: `SELECT
  SUM(i) -- 3
FROM UNNEST([1, 2]) AS i`,
  },
  // ----- statistical aggregate functions -----
  {
    ident: "CORR",
    example: `SELECT
  CORR(x, y) -- 1.0
FROM UNNEST([
  STRUCT(1 AS x, 2 AS y),
        (2     , 4     ),
        (3     , 6     )
])`,
  },
  {
    ident: "COVAR_POP",
    example: `SELECT
  COVAR_POP(x, y), -- 1.3333333333333333
  COVAR_SAMP(x, y), -- 2.0
FROM UNNEST([
  STRUCT(1 AS x, 2 AS y),
        (2     , 4     ),
        (3     , 6     )
])`,
  },
  {
    ident: "COVAR_SAMP",
    example: `SELECT
  COVAR_SAMP(x, y), -- 2.0
  COVAR_POP(x, y), -- 1.3333333333333333
FROM UNNEST([
  STRUCT(1 AS x, 2 AS y),
        (2     , 4     ),
        (3     , 6     )
])`,
  },
  {
    ident: "STDDEV_POP",
    example: `SELECT
  STDDEV_POP(x),  -- 0.816496580927726
  STDDEV_SAMP(x), -- 1.0
FROM UNNEST([1, 2, 3]) AS x`,
  },
  {
    ident: "STDDEV_SAMP",
    example: `SELECT
  STDDEV_SAMP(x), -- 1.0
  STDDEV_POP(x),  -- 0.816496580927726
FROM UNNEST([1, 2, 3]) AS x`,
  },
  {
    ident: "STDDEV",
    example: `/* An alias of STDDEV_SAMP() */
SELECT
  STDDEV(x) -- 1.0
FROM UNNEST([1, 2, 3]) AS x`,
  },
  {
    ident: "VAR_POP",
    example: `SELECT
  VAR_SAMP(x), -- 1.0
  VAR_POP(x),  -- 0.6666666666666666
FROM UNNEST([1, 2, 3]) AS x`,
  },
  {
    ident: "VAR_SAMP",
    example: `SELECT
  VAR_POP(x),  -- 0.6666666666666666
  VAR_SAMP(x), -- 1.0
FROM UNNEST([1, 2, 3]) AS x`,
  },
  {
    ident: "VARIANCE",
    example: `/* An alias of VAR_SAMP() */
SELECT
  VARIANCE(x), -- 1.0
FROM UNNEST([1, 2, 3]) AS x`,
  },
  // ----- approximate aggregate functions -----
  {
    ident: "APPROX_COUNT_DISTINCT",
    example: `SELECT
  APPROX_COUNT_DISTINCT(i) -- 3
FROM UNNEST([1, 1, 2, 3]) AS i`,
  },
  {
    ident: "APPROX_QUANTILES",
    example: `SELECT
  -- [1, 5, 9]
  APPROX_QUANTILES(i, 2),
  -- [1, 3, 6, 9]
  APPROX_QUANTILES(i, 3),
FROM UNNEST(GENERATE_ARRAY(1,9)) AS i`,
  },
  {
    ident: "APPROX_TOP_COUNT",
    example: `SELECT
  -- [STRUCT('a' AS value, 3 AS count)]
  APPROX_TOP_COUNT(str, 1)
FROM UNNEST([
  'a', 'a', 'a',
  'b', 'b',
  'c'
]) AS str`,
  },
  {
    ident: "APPROX_TOP_SUM",
    example: `SELECT
  -- [STRUCT('b' AS value, 4 AS sum)]
  APPROX_TOP_SUM(value, weight, 1)
FROM UNNEST([
  STRUCT('a' AS value, 3 AS weight),
        ('b'         , 2          ),
        ('b'         , 2          ),
        ('c'         , 1          )
])`,
  },
  // DLP encryption functions
  "DLP_DETERMINISTIC_ENCRYPT",
  "DLP_DETERMINISTIC_DECRYPT",
  "DLP_KEY_CHAIN",
  // ----- numbering functions -----
  {
    ident: "RANK",
    example: `/**
 * x, rank
 * 0,    1
 * 1,    2
 * 1,    2
 * 2,    4
 */
SELECT
  x,
  RANK() OVER (ORDER BY x) AS rank
FROM UNNEST([0, 1, 1, 2]) AS x
ORDER BY x`,
  },
  {
    ident: "DENSE_RANK",
    example: `/**
 * x, rank
 * 0,    1
 * 1,    2
 * 1,    2
 * 2,    3
 */
SELECT
  x,
  DENSE_RANK() OVER (ORDER BY x) AS rank
FROM UNNEST([0, 1, 1, 2]) AS x
ORDER BY x`,
  },
  {
    ident: "PERCENT_RANK",
    example: `/**
 * x, percent
 * 0, 0.0
 * 1, 0.3333333333333333
 * 1, 0.3333333333333333
 * 2, 1.0
 */
SELECT
  x,
  PERCENT_RANK() OVER (ORDER BY x) AS percent
FROM UNNEST([0, 1, 1, 2]) AS x
ORDER BY x`,
  },
  {
    ident: "CUME_DIST",
    example: `/**
 * x, cume
 * 0,  0.2
 * 1,  0.6
 * 1,  0.6
 * 2,  0.8
 * 3,  1.0
 */
SELECT
  x,
  CUME_DIST() OVER (ORDER BY x) AS cume
FROM UNNEST([0, 1, 1, 2, 3]) AS x
ORDER BY x`,
  },
  {
    ident: "NTILE",
    example: `/**
 * x, ntile
 * 0,     1
 * 1,     1
 * 1,     2
 * 2,     2
 * 3,     3
 */
SELECT
  x,
  NTILE(3) OVER (ORDER BY x) AS ntile
FROM UNNEST([0, 1, 1, 2, 3]) AS x
ORDER BY x`,
  },
  {
    ident: "ROW_NUMBER",
    example: `/**
 * x, num
 * 0,   1
 * 1,   2
 * 1,   3
 * 2,   4
 */
SELECT
  x,
  ROW_NUMBER() OVER (ORDER BY x) AS num
FROM UNNEST([0, 1, 1, 2]) AS x
ORDER BY x`,
  },
  // ----- search functions -----
  {
    ident: "SEARCH",
    example: `SELECT
  SEARCH('foo', 'foo bar'), -- false
  SEARCH('foo-bar', 'foo bar'), -- true
  SEARCH('foo-bar', '\`foo bar\`'), -- false
  SEARCH('FOO-BAR', 'foo bar'), -- true
  SEARCH(STRUCT('foo', 'bar'), 'foo bar'), -- false
  SEARCH(STRUCT('foo bar', 'bar'), 'foo bar'), -- true
  SEARCH(
    JSON '{"key": "val"}',
    'key'
  ), -- false
  SEARCH(
    JSON '{"key": "val"}',
    'val',
    json_scope => 'JSON_KEYS_AND_VALUES'
  ), -- true`,
  },
  "VECTOR_SEARCH",
  // ----- bit functions -----
  {
    ident: "BIT_COUNT",
    example: `SELECT
  BIT_COUNT(b'\\x00'), -- 0
  BIT_COUNT(b'\\x03'), -- 2
  BIT_COUNT(b'\\x08'), -- 1`,
  },
  // ----- built-in table functions -----
  {
    ident: "EXTERNAL_OBJECT_TRANSFORM",
    example: `SELECT uri
FROM EXTERNAL_OBJECT_TRANSFORM(
  TABLE tablename,
  ["SIGNED_URL"]
)`,
  },
  // ----- conversion functions -----
  {
    ident: "CAST",
    example: `SELECT
  CAST('1' AS INT64), -- 1
  CAST(
    DATE "2020-01-01" AS STRING
    FORMAT 'YYYYMMDD'
  ), -- '20200101'`,
  },
  {
    ident: "PARSE_BIGNUMERIC",
    example: `SELECT
  -- BIGNUMERIC '111.11'
  PARSE_BIGNUMERIC('111.11'),
  -- BIGNUMERIC '111.11E2'
  PARSE_BIGNUMERIC('111.11E2'),`,
  },
  {
    ident: "PARSE_NUMERIC",
    example: `SELECT
  -- NUMERIC '111.11'
  PARSE_NUMERIC('111.11'),
  -- NUMERIC '111.11E2'
  PARSE_NUMERIC('111.11E2'),`,
  },
  {
    ident: "SAFE_CAST",
    example: `SELECT
  SEFE_CAST('1' AS INT64), -- 1
  SAFE_CAST(
    DATE "2020-01-01" AS STRING
    FORMAT 'YYYYMMDD'
  ), -- '20200101'
  SAFE_CAST('' AS DATE), -- NULL`,
  },
  // ----- mathematical functions -----
  {
    ident: "ABS",
    example: `SELECT
  ABS(-5), -- 5
  ABS( 5), -- 5`,
  },
  {
    ident: "SIGN",
    example: `SELECT
  SIGN(-5), -- -1
  SIGN( 0), --  0
  SIGN( 5), --  1`,
  },
  {
    ident: "IS_INF",
    example: `SELECT
  -- false
  IS_INF(0),
  -- true
  IS_INF(CAST('+inf' AS FLOAT64)),
  -- true
  IS_INF(CAST('-inf' AS FLOAT64)),`,
  },
  {
    ident: "IS_NAN",
    example: `SELECT
  IS_NAN(0), -- false
  IS_NAN(
    CAST('NaN' AS FLOAT64)
  ), -- true`,
  },
  {
    ident: "IEEE_DIVIDE",
    example: `SELECT
  -- 5.0
  IEEE_DIVIDE(5, 1),
  -- CAST('+inf' AS FLOAT64)
  IEEE_DIVIDE(5, 0),
  -- CAST('NaN' AS FLOAT64)
  IEEE_DIVIDE(
    5,
    CAST('NaN' AS FLOAT64)
  ),`,
  },
  {
    ident: "RAND",
    example: `SELECT
  -- 0 <= RAND() AND RAND() < 1
  RAND(), -- 0.1132807696320793
  RAND(), -- 0.5858601499107345`,
  },
  { ident: "SQRT", example: `SELECT SQRT(4) -- 2.0` },
  { ident: "POW", example: `SELECT POW(2, 3) -- 8.0` },
  {
    ident: "POWER",
    example: `/* An alias of POW() */
SELECT POWER(2, 3) -- 8.0`,
  },
  {
    ident: "EXP",
    example: `SELECT
  EXP(0), -- 1.0
  EXP(1), -- 2.718281828459045`,
  },
  {
    ident: "EUCLIDEAN_DISTANCE",
    example: `SELECT
  -- 1.4142135623730951
  EUCLIDEAN_DISTANCE([0.0, 0,0], [1.0, 1.0]),`,
  },
  { ident: "LN", example: `SELECT LN(2.718281828459045) -- 1.0` },
  { ident: "LOG", example: `SELECT LOG(8, 2) -- 3.0` },
  { ident: "LOG10", example: `SELECT LOG10(100) -- 2.0` },
  { ident: "GREATEST", example: `SELECT GREATEST(1, 2, 3) -- 3` },
  { ident: "LEAST", example: `SELECT LEAST(1, 2, 3) -- 1` },
  { ident: "DIV", example: `SELECT DIV(10, 4) -- 2` },
  {
    ident: "SAFE_DIVIDE",
    example: `SELECT
  SAFE_DIVIDE(10, 4), -- 2.5
  SAFE_DIVIDE(10, 0), -- NULL`,
  },
  {
    ident: "SAFE_MULTIPLY",
    example: `SELECT
  SAFE_MULTIPLY(2, 3), -- 6
  SAFE_MULTIPLY(
    2,
    9223372036854775807
  ), -- NULL`,
  },
  {
    ident: "SAFE_NEGATE",
    example: `SELECT
  SAFE_NEGATE( 5), -- -5
  SAFE_NEGATE(-5), --  5
  SAFE_NEGATE(
    -9223372036854775808
  ), --  NULL`,
  },
  {
    ident: "SAFE_ADD",
    example: `SELECT
  SAFE_ADD(1, 2), -- 3
  SAFE_ADD(
    1,
    9223372036854775807
  ), -- NULL`,
  },
  {
    ident: "SAFE_SUBTRACT",
    example: `SELECT
  SAFE_SUBTRACT(1, 3), -- -2
  SAFE_SUBTRACT(
    -9223372036854775808,
    1
  ), --  NULL`,
  },
  { ident: "MOD", example: `SELECT MOD(12, 10) -- 2` },
  {
    ident: "ROUND",
    example: `SELECT
  ROUND(123.45), -- 123.0
  ROUND(123.45,  1), -- 123.5
  ROUND(123.45, -1), -- 120.0`,
  },
  {
    ident: "TRUNC",
    example: `SELECT
  TRUNC(1234.56), -- 1234.0
  TRUNC(1234.56,  1), -- 1234.5
  TRUNC(1234.56, -1), -- 1230.0`,
  },
  {
    ident: "CEIL",
    example: `SELECT
  CEIL(-0.3), --  0.0
  CEIL( 0.0), --  0.0
  CEIL( 0.3), --  1.0`,
  },
  {
    ident: "CEILING",
    example: `SELECT
  CEILING(-0.3), -- 0.0
  CEILING( 0.0), -- 0.0
  CEILING( 0.3), -- 1.0`,
  },
  {
    ident: "FLOOR",
    example: `SELECT
  FLOOR(-0.3), -- -1.0
  FLOOR( 0.0), --  0.0
  FLOOR( 0.3), --  0.0`,
  },
  {
    ident: "COS",
    example: `SELECT COS(0) -- 1.0`,
  },
  "COSH",
  {
    ident: "COSINE_DISTANCE",
    example: `SELECT
  -- 1.0
  COSINE_DISTANCE([1.0, 0.0], [0.0, 1.0])`,
  },
  "ACOS",
  "ACOSH",
  { ident: "SIN", example: `SELECT SIN(0) -- 0.0` },
  "SINH",
  "ASIN",
  "ASINH",
  "COT",
  "COTH",
  "CSC",
  "CSCH",
  "SEC",
  "SECH",
  { ident: "TAN", example: `SELECT TAN(0) -- 0.0` },
  "TANH",
  "ATAN",
  "ATANH",
  "ATAN2",
  "CBRT",
  {
    ident: "RANGE_BUCKET",
    example: `SELECT
  RANGE_BUCKET( 0, [1, 3, 5, 7, 9]), -- 0
  RANGE_BUCKET( 1, [1, 3, 5, 7, 9]), -- 1
  RANGE_BUCKET( 2, [1, 3, 5, 7, 9]), -- 1
  RANGE_BUCKET( 9, [1, 3, 5, 7, 9]), -- 5
  RANGE_BUCKET(10, [1, 3, 5, 7, 9]), -- 5`,
  },
  // ----- navigation functions -----
  {
    ident: "FIRST_VALUE",
    example: `/**
 * x, first
 * 1, a
 * 2, a
 * 3, a
 */
SELECT
  x,
  FIRST_VALUE(y) OVER(
    ORDER BY x
    ROWS BETWEEN
      UNBOUNDED PRECEDING
      AND UNBOUNDED FOLLOWING
  ) AS first,
FROM UNNEST([
  STRUCT(1 AS x, 'a' AS y),
        (2     , 'b'     ),
        (3     , 'c'     )
])
ORDER BY x`,
  },
  {
    ident: "LAST_VALUE",
    example: `/**
 * x, last
 * 1, c
 * 2, c
 * 3, c
 */
SELECT
  x,
  LAST_VALUE(y) OVER(
    ORDER BY x
    ROWS BETWEEN
      UNBOUNDED PRECEDING
      AND UNBOUNDED FOLLOWING
  ) AS last,
FROM UNNEST([
  STRUCT(1 AS x, 'a' AS y),
        (2     , 'b'     ),
        (3     , 'c'     )
])
ORDER BY x`,
  },
  {
    ident: "NTH_VALUE",
    example: `/**
 * x, y, nth_value
 * 1, 1, b
 * 2, 1, b
 * 3, 2,
 */
SELECT
  x,
  y,
  NTH_VALUE(z, 2) OVER(
    PARTITION BY y
    ORDER BY x
    ROWS BETWEEN
      UNBOUNDED PRECEDING
      AND UNBOUNDED FOLLOWING
  ) AS nth_value,
FROM UNNEST([
  STRUCT(1 AS x, 1 AS y, 'a' AS z),
        (2     , 1     , 'b'     ),
        (3     , 2     , 'c'     )
])
ORDER BY x`,
  },
  {
    ident: "LEAD",
    example: `/**
 * x, lead1, lead2, lead3
 * 1,    12,    13,    13
 * 2,    13,      ,     0
 * 3,      ,      ,     0
 */
SELECT
  x,
  LEAD(y      ) OVER (ORDER BY x) AS lead1,
  LEAD(y, 2   ) OVER (ORDER BY x) AS lead2,
  LEAD(y, 2, 0) OVER (ORDER BY x) AS lead3,
FROM UNNEST([
  STRUCT(1 AS x, 11 AS y),
        (2     , 12     ),
        (3     , 13     )
])
ORDER BY x`,
  },
  {
    ident: "LAG",
    example: `/**
 * x, lag1, lag2, lag3
 * 1,     ,     ,    0
 * 2,   11,     ,    0
 * 3,   12,   11,   11
 */
SELECT
  x,
  LAG(y      ) OVER (ORDER BY x) lag1,
  LAG(y, 2   ) OVER (ORDER BY x) lag2,
  LAG(y, 2, 0) OVER (ORDER BY x) lag3,
FROM UNNEST([
  STRUCT(1 AS x, 11 AS y),
        (2     , 12     ),
        (3     , 13     )
])
ORDER BY x`,
  },
  {
    ident: "PERCENTILE_CONT",
    example: `/**
 * min, median, max
 * 0.0,    1.5, 3.0
 */
SELECT
  PERCENTILE_CONT(x, 0.0) OVER() min,
  PERCENTILE_CONT(x, 0.5) OVER() median,
  PERCENTILE_CONT(x, 1.0) OVER() max,
FROM UNNEST([0, 1, 2, 3]) AS x
LIMIT 1`,
  },
  {
    ident: "PERCENTILE_DISC",
    example: `/**
 * min, median, max
 *   0,      1,   3
 */
SELECT
  PERCENTILE_DISC(x, 0.0) OVER() min,
  PERCENTILE_DISC(x, 0.5) OVER() median,
  PERCENTILE_DISC(x, 1.0) OVER() max,
FROM UNNEST([0, 1, 2, 3]) AS x
LIMIT 1`,
  },
  // ----- hash functions -----
  {
    ident: "FARM_FINGERPRINT",
    example: `SELECT
  -- -7968278744132540956
  FARM_FINGERPRINT('X'),
  -- 8573515363966238755
  FARM_FINGERPRINT('Y'),`,
  },
  {
    ident: "MD5",
    example: `SELECT
  MD5('XXX') -- b'\\xf5a\\xaa...'`,
  },
  {
    ident: "SHA1",
    example: `SELECT
  SHA1('xxx') -- b'\\xb6\\x0d...'`,
  },
  {
    ident: "SHA256",
    example: `SELECT
  SHA256('xxx') -- b'\\xcd.\\xb0...'`,
  },
  {
    ident: "SHA512",
    example: `SELECT
  SHA512('xxx') -- b'\\x90W\\xff'`,
  },
  // ----- string functions -----
  { ident: "ASCII", example: `SELECT ASCII('A') -- 65` },
  {
    ident: "BYTE_LENGTH",
    example: `SELECT
  BYTE_LENGTH(b'\\xc3\\xa9'), -- 2
  BYTE_LENGTH('café'), -- 5`,
  },
  { ident: "CHAR_LENGTH", example: `SELECT CHAR_LENGTH('ABC') -- 3` },
  {
    ident: "CHARACTER_LENGTH",
    example: `/* An alias of CHAR_LENGTH */
SELECT CHARACTER_LENGTH('ABC') -- 3`,
  },
  { ident: "CHR", example: `SELECT CHR(65) -- 'A'` },
  {
    ident: "CODE_POINTS_TO_BYTES",
    example: `SELECT
  CODE_POINTS_TO_BYTES([65]), -- b'\\x41'
  CODE_POINTS_TO_STRING([65]), -- 'A'`,
  },
  {
    ident: "CODE_POINTS_TO_STRING",
    example: `SELECT
  CODE_POINTS_TO_STRING([65]), -- 'A'
  CODE_POINTS_TO_BYTES([65]), -- b'\\x41'`,
  },
  {
    ident: "COLLATE",
    example: `SELECT
  'abc' = COLLATE('ABC', "und:ci") -- true`,
  },
  {
    ident: "CONCAT",
    example: `SELECT CONCAT('A', 'B', 'C') -- 'ABC'`,
  },
  {
    ident: "CONTAINS_SUBSTR",
    example: `SELECT
  -- true
  CONTAINS_SUBSTR('BigQuery', 'Big'),
  -- true
  CONTAINS_SUBSTR('BigQuery', 'big'),
  -- true
  CONTAINS_SUBSTR(
    ('BigQuery', NULL),
    'Big'
  ),
  -- false
  CONTAINS_SUBSTR(('BQ', ''), 'Big'),
  -- NULL
  CONTAINS_SUBSTR(('BQ', NULL), 'Big'),
  -- true
  CONTAINS_SUBSTR([1, 2], '1')`,
  },
  {
    ident: "EDIT_DISTANCE",
    example: `SELECT
  EDIT_DISTANCE('aaa', 'abc'), -- 2`,
  },
  {
    ident: "ENDS_WITH",
    example: `SELECT
  ENDS_WITH('BigQuery', 'Query'), -- true
  ENDS_WITH('BigQuery', 'query'), -- false`,
  },
  {
    ident: "FORMAT",
    example: `SELECT
  FORMAT('%d', 1000), -- '1000'
  FORMAT("%'d", 1000), -- '1,000'
  FORMAT("%'6d", 1000), -- ' 1,000'
  FORMAT("%'*d", 6, 1000), -- ' 1,000'
  FORMAT('%.2f', 1.234), -- '1.23'
  FORMAT('%.*f', 2, 1.234), -- '1.23'
  FORMAT('%T', NULL), -- 'NULL'`,
  },
  {
    ident: "FROM_BASE32",
    example: `SELECT
  FROM_BASE32('MFRGG==='), -- b'abc'
  TO_BASE32(b'abc'), -- 'MFRGG==='`,
  },
  {
    ident: "FROM_BASE64",
    example: `SELECT
  FROM_BASE64('YWJj'), -- b'abc'
  TO_BASE64(b'abc'), -- 'YWJj'`,
  },
  {
    ident: "FROM_HEX",
    example: `SELECT
  FROM_HEX('78797a'), -- b'\\x78\\x79\\x7a'
  TO_HEX(b'\\x78\\x79\\x7a'), -- '78797a'`,
  },
  {
    ident: "INITCAP",
    example: `SELECT
  -- I Have A Theree-Year-Old Daughter.
  INITCAP('I HAVE a three-year-old daughter.'),
  -- I Have A Theree-year-old Daughter.
  INITCAP(
    'I HAVE a three-year-old daughter.',
    ' ' -- delimiters
  ),`,
  },
  {
    ident: "INSTR",
    example: `SELECT
  INSTR('abcdefabcdef', 'abc'), -- 1
  INSTR('abcdefabcdef', 'xyz'), -- 0
  INSTR(
    'abcdefabcdef',
    'abc',
    2 -- position
  ), -- 7
  INSTR(
    'abcdefabcdef',
    'abc',
    -7 -- position (backwards)
  ), -- 1
  INSTR(
    'abcdefabcdef',
    'abc',
    1,
    2 -- Nth occurrence
  ), -- 7`,
  },
  { ident: "LEFT", example: `SELECT LEFT('abc', 2) -- 'ab'` },
  {
    ident: "LENGTH",
    example: `SELECT
  LENGTH('café'), -- 4
  LENGTH(CAST('café' AS BYTES)), -- 5`,
  },
  {
    ident: "LPAD",
    example: `SELECT
  LPAD('abc', 5), -- '  abc'
  LPAD('abc', 5, '.'), -- '..abc'
  LPAD('abc', 2), -- 'ab'`,
  },
  { ident: "LOWER", example: `SELECT LOWER('BigQuery') -- 'bigquery'` },
  {
    ident: "LTRIM",
    example: `SELECT
  LTRIM('  abc  '), -- 'abc  '
  LTRIM('["abc"]', '"[]'), -- 'abc"]'`,
  },
  {
    ident: "NORMALIZE",
    example: `SELECT
  -- true
  NORMALIZE('A1', NFKC)
  = NORMALIZE('A１', NFKC),
  -- false
  NORMALIZE('A1', NFKC)
  = NORMALIZE('a１', NFKC),`,
  },
  {
    ident: "NORMALIZE_AND_CASEFOLD",
    example: `SELECT
  -- true
  NORMALIZE_AND_CASEFOLD('A1', NFKC)
  = NORMALIZE_AND_CASEFOLD('a１', NFKC)`,
  },
  {
    ident: "OCTET_LENGTH",
    example: `/* An alias of BYTE_LENGTH() */
SELECT
  OCTET_LENGTH(b'\\xc3\\xa9'), -- 2
  OCTET_LENGTH('café'), -- 5`,
  },
  {
    ident: "REGEXP_CONTAINS",
    example: `SELECT
  -- true
  REGEXP_CONTAINS('abc', r'c$')`,
  },
  {
    ident: "REGEXP_EXTRACT",
    example: `SELECT
  -- 'abc'
  REGEXP_EXTRACT('abcabc', 'abc$'),
  -- 'bc'
  REGEXP_EXTRACT('abcabc', 'a(bc)$'),
  -- 'bcabc'
  REGEXP_EXTRACT('abcabc', '.*', 2),
  -- 'a'
  REGEXP_EXTRACT(
    'abcabc',
    '[a-z]',
    1,
    4 -- Nth occurrence
  ),`,
  },
  {
    ident: "REGEXP_EXTRACT_ALL",
    example: `SELECT
  -- ['oo', 'ou', 'or']
  REGEXP_EXTRACT_ALL(
    'Google Cloud Platform',
    'o.'
  )`,
  },
  {
    ident: "REGEXP_INSTR",
    example: `SELECT
  REGEXP_INSTR('abcdabcd', 'abc'), -- 1
  REGEXP_INSTR('abcdabcd', 'xyz'), -- 0
  REGEXP_INSTR(
    'abcdabcd',
    'abc',
    2 -- position
  ), -- 5
  REGEXP_INSTR(
    'abcdabcd',
    'abc',
    1,
    2 -- Nth occurrence
  ), -- 5
  REGEXP_INSTR(
    'abcdabcd',
    'abc',
    1,
    1,
    1 -- occurrence position (0 or 1)
  ), -- 4`,
  },
  {
    ident: "REGEXP_REPLACE",
    example: `SELECT
  -- 'Bigtable'
  REGEXP_REPLACE('BigQuery', 'Query', 'table'),
  -- 'BigBigQuery'
  REGEXP_REPLACE('BigQuery', 'Big', r'\\0\\0'),
  -- 'Query'
  REGEXP_REPLACE('BigQuery', 'Big(Query)', r'\\1'),`,
  },
  {
    ident: "REGEXP_SUBSTR",
    example: `/* An alias of REGEXP_EXTRACT() */
SELECT
  -- 'abc'
  REGEXP_SUBSTR('abcabc', 'abc$'),
  -- 'bc'
  REGEXP_SUBSTR('abcabc', 'a(bc)$'),
  -- 'bcabc'
  REGEXP_SUBSTR('abcabc', '.*', 2),
  -- 'a'
  REGEXP_SUBSTR(
    'abcabc',
    '[a-z]',
    1,
    4 -- Nth occurrence
  ),`,
  },
  {
    ident: "REPLACE",
    example: `SELECT
  -- Doodle
  REPLACE('Google', 'Goog', 'Dood')`,
  },
  { ident: "REPEAT", example: `SELECT REPEAT('abc', 2) -- 'abcabc'` },
  { ident: "REVERSE", example: `SELECT REVERSE('abc') -- 'cba'` },
  { ident: "RIGHT", example: `SELECT RIGHT('abc', 2) -- 'bc'` },
  {
    ident: "RPAD",
    example: `SELECT
  RPAD('abc', 5), -- 'abc  '
  RPAD('abc', 5, '.'), -- 'abc..'
  RPAD('abc', 2), -- 'ab'`,
  },
  {
    ident: "RTRIM",
    example: `SELECT
  RTRIM('  abc  '), -- '  abc'
  RTRIM('["abc"]', '"[]'), -- '["abc'`,
  },
  {
    ident: "SAFE_CONVERT_BYTES_TO_STRING",
    example: `SELECT
  SAFE_CONVERT_BYTES_TO_STRING(
    b'\\x41\\x42\\x43'
  ) -- 'ABC'`,
  },
  { ident: "SOUNDEX", example: `SELECT SOUNDEX('query') -- 'q600'` },
  {
    ident: "SPLIT",
    example: `SELECT
  SPLIT('a,b'), -- ['a', 'b']
  SPLIT('a|b', '|'), -- ['a', 'b']`,
  },
  {
    ident: "STARTS_WITH",
    example: `SELECT
  STARTS_WITH('BigQuery', 'Big'), -- true
  STARTS_WITH('BigQuery', 'big'), -- false`,
  },
  { ident: "STRPOS", example: `SELECT STRPOS('Google', 'o') -- 2` },
  {
    ident: "SUBSTR",
    example: `SELECT
  SUBSTR('Google',  2), -- 'oogle'
  SUBSTR('Google', -1), -- 'e'
  SUBSTR('Google',  2, 2), -- 'oo'`,
  },
  {
    ident: "SUBSTRING",
    example: `/* An alias of SUBSTR() */
SELECT
  SUBSTRING('Google',  2), -- 'oogle'
  SUBSTRING('Google', -1), -- 'e'
  SUBSTRING('Google',  2, 2), -- 'oo'`,
  },
  {
    ident: "TO_BASE32",
    example: `SELECT
  TO_BASE32(b'abc'), -- 'MFRGG==='
  FROM_BASE32('MFRGG==='), -- b'abc'`,
  },
  {
    ident: "TO_BASE64",
    example: `SELECT
  TO_BASE64(b'abc'), -- 'YWJj'
  FROM_BASE64('YWJj'), -- b'abc'`,
  },
  "TO_CODE_POINTS",
  {
    ident: "TO_HEX",
    example: `SELECT
  TO_HEX(b'\\x78\\x79\\x7a'), -- '78797a'
  FROM_HEX('78797a'), -- b'\\x78\\x79\\x7a'`,
  },
  {
    ident: "TRANSLATE",
    example: `SELECT
  -- 'xbcye'
  TRANSLATE('abcde', 'ad', 'xy')`,
  },
  {
    ident: "TRIM",
    example: `SELECT
  TRIM('  abc  '), -- 'abc'
  TRIM('["abc"]', '"[]'), -- 'abc'`,
  },
  { ident: "UNICODE", example: `SELECT UNICODE('é') -- 233` },
  { ident: "UPPER", example: `SELECT UPPER('BigQuery') -- 'BIGQUERY'` },
  // ----- json functions -----
  {
    ident: "BOOL",
    example: `SELECT BOOL(JSON 'false') -- false`,
  },
  {
    ident: "FLOAT64",
    example: `SELECT
  -- 1.2345678901234568E16
  FLOAT64(JSON '12345678901234567'),
  -- ERROR('...')
  FLOAT64(
    JSON '12345678901234567',
    wide_number_mode => 'exact'
  ),`,
  },
  {
    ident: "INT64",
    example: `SELECT INT64(JSON '123') -- 123`,
  },
  {
    ident: "JSON_ARRAY",
    example: `SELECT
  JSON_ARRAY(1, 2) -- JSON '[1, 2]'`,
  },
  {
    ident: "JSON_ARRAY_APPEND",
    example: `SELECT
  -- JSON '[1, 2, 3]'
  JSON_ARRAY_APPEND(JSON '[1, 2]', '$', 3),
  -- JSON '[1, 2, 3, 4]'
  JSON_ARRAY_APPEND(JSON '[1, 2]', '$', [3, 4]),
  -- JSON '[1, 2, [3], 4]'
  JSON_ARRAY_APPEND(
    JSON '[1, 2]',
    '$', [3],
    '$', 4,
    append_each_element => false
  ),`,
  },
  {
    ident: "JSON_ARRAY_INSERT",
    example: `SELECT
  -- JSON '[3, 1, 2]'
  JSON_ARRAY_INSERT(JSON '[1, 2]', '$[0]', 3),
  -- JSON '[3, 4, 1, 2]'
  JSON_ARRAY_INSERT(
    JSON '[1, 2]',
    '$[0]',
    [3, 4]
  ),
  -- JSON '[4, [3], 1, 2]'
  JSON_ARRAY_INSERT(
    JSON '[1, 2]',
    '$[0]', [3],
    '$[0]', 4,
    insert_each_element => false
  ),`,
  },
  {
    ident: "JSON_EXTRACT",
    example: `SELECT
  JSON_EXTRACT(
    '{"x": "xxx"}', '$.x'
  ), -- '"xxx"'
  JSON_EXTRACT(
    '{"x": "xxx"}', '$.y'
  ), -- NULL
  JSON_EXTRACT(
    '{"x": [1, 2]}', '$.x[0]'
  ), -- '1'
  JSON_EXTRACT(
    '{"x.y": [1, 2]}', "$['x.y']"
  ), -- '[1,2]'

  JSON_EXTRACT(
    JSON '"xxx"', '$'
  ), -- JSON '"xxx"'
  JSON_EXTRACT(
    JSON 'null', '$.x'
  ), -- NULL
  JSON_EXTRACT(
    JSON 'null', '$'
  ), -- JSON 'null'`,
  },
  {
    ident: "JSON_EXTRACT_ARRAY",
    example: `SELECT
  -- ['"a"', '"b"']
  JSON_EXTRACT_ARRAY('["a", "b"]'),
  -- ['"a"', '"b"']
  JSON_EXTRACT_ARRAY(
    '{"x": ["a", "b"]}', '$.x'
  ),
  -- NULL
  JSON_EXTRACT_ARRAY(
    '{"x": ["a", "b"]}', '$.y'
  ),
  -- ['"a"', '"b"']
  JSON_EXTRACT_ARRAY(
    '{"x.y": ["a", "b"]}', "$['x.y']"
  ),

  -- [JSON '"a"', JSON '"b"']
  JSON_EXTRACT_ARRAY(
    JSON '["a", "b"]', '$'
  ),
  -- NULL
  JSON_EXTRACT_ARRAY(
    JSON '["a", "b"]', '$.x'
  ),
  -- NULL
  JSON_EXTRACT_ARRAY(JSON '"a"', '$'),`,
  },
  {
    ident: "JSON_EXTRACT_SCALAR",
    example: `SELECT
  JSON_EXTRACT_SCALAR(
    '{"x": "xxx"}', '$.x'
  ), -- 'xxx'
  JSON_EXTRACT_SCALAR(
    '{"x": "xxx"}', '$.y'
  ), -- NULL
  JSON_EXTRACT_SCALAR(
    '{"x": [1, 2]}', '$.x[0]'
  ), -- '1'
  JSON_EXTRACT_SCALAR(
    '{"x.y": [1, 2]}', "$['x.y']"
  ), -- NULL

  JSON_EXTRACT_SCALAR(
    JSON '"xxx"', '$'
  ), -- 'xxx'
  JSON_EXTRACT_SCALAR(
    JSON 'null', '$.x'
  ), -- NULL
  JSON_EXTRACT_SCALAR(
    JSON 'null', '$'
  ), -- NULL`,
  },
  {
    ident: "JSON_EXTRACT_STRING_ARRAY",
    example: `SELECT
  -- ['a']
  JSON_EXTRACT_STRING_ARRAY('["a"]'),
  -- ['a']
  JSON_EXTRACT_STRING_ARRAY(
    '{"x": ["a"]}', '$.x'
  ),
  -- NULL
  JSON_EXTRACT_STRING_ARRAY(
    '{"x": ["a"]}', '$.y'
  ),
  -- ['a']
  JSON_EXTRACT_STRING_ARRAY(
    '{"x.y": ["a"]}', "$['x.y']"
  ),

  -- ['a', 'b']
  JSON_EXTRACT_STRING_ARRAY(
    JSON '["a", "b"]', '$'
  ),
  -- NULL
  JSON_EXTRACT_STRING_ARRAY(
    JSON '["a", "b"]', '$.x'
  ),
  -- NULL
  JSON_EXTRACT_STRING_ARRAY(
    JSON '"a"', '$'
  ),`,
  },
  {
    ident: "JSON_OBJECT",
    example: `SELECT
  -- JSON '{"a": 1, "b": 2}'
  JSON_OBJECT("a", 1, "b", 2),
  -- JSON '{"a": 1, "b": 2}'
  JSON_OBJECT(["a", "b"], [1, 2]),`,
  },
  {
    ident: "JSON_REMOVE",
    example: `SELECT
  -- JSON '[2]'
  JSON_REMOVE(JSON '[1, 2]', '$[0]'),
  -- JSON '{"c": 3}'
  JSON_REMOVE(
    JSON '{"a": 1, "b": 2, "c": 3}',
    '$.a',
    '$.b'
  ),`,
  },
  {
    ident: "JSON_SET",
    example: `SELECT
  -- JSON '[1, 2]'
  JSON_SET(JSON '{"a": 1}', '$', [1, 2]),
  -- JSON '{"a": 10, "b": 20}'
  JSON_SET(
    JSON '{"a": 1}',
    '$.a', 10,
    '$.b', 20
  ),`,
  },
  {
    ident: "JSON_STRIP_NULLS",
    example: `SELECT
  -- JSON '{"a": []}'
  JSON_STRIP_NULLS(JSON '{"a": [null], "b": null}'),
  -- JSON '{"a": [], "b": null}'
  JSON_STRIP_NULLS(
    JSON '{"a": [null], "b": null}',
    '$.a'
  ),
  -- JSON '{"a": [null]}'
  JSON_STRIP_NULLS(
    JSON '{"a": [null], "b": null}',
    include_arrays => false
  ),
  -- JSON 'null'
  JSON_STRIP_NULLS(
    JSON '{"a": [null], "b": null}',
    remove_empty => true
  ),`,
  },
  {
    ident: "JSON_QUERY",
    example: `SELECT
  JSON_QUERY(
    '{"x": "xxx"}', '$.x'
  ), -- '"xxx"'
  JSON_QUERY(
    '{"x": "xxx"}', '$.y'
  ), -- NULL
  JSON_QUERY(
    '{"x": [1, 2]}', '$.x[0]'
  ), -- '1'
  JSON_QUERY(
    '{"x.y": [1, 2]}', '$."x.y"'
  ), -- '[1,2]'

  JSON_QUERY(
    JSON '"xxx"', '$'
  ), -- JSON '"xxx"'
  JSON_QUERY(
    JSON 'null', '$.x'
  ), -- NULL
  JSON_QUERY(
    JSON 'null', '$'
  ), -- JSON 'null'`,
  },
  {
    ident: "JSON_QUERY_ARRAY",
    example: `SELECT
  -- ['"a"', '"b"']
  JSON_QUERY_ARRAY('["a", "b"]'),
  -- ['"a"', '"b"']
  JSON_QUERY_ARRAY(
    '{"x": ["a", "b"]}', '$.x'
  ),
  -- NULL
  JSON_QUERY_ARRAY(
    '{"x": ["a", "b"]}', '$.y'
  ),
  -- ['"a"', '"b"']
  JSON_QUERY_ARRAY(
    '{"x.y": ["a", "b"]}', '$."x.y"'
  ),

  -- [JSON '"a"', JSON '"b"']
  JSON_QUERY_ARRAY(
    JSON '["a", "b"]', '$'
  ),
  -- NULL
  JSON_QUERY_ARRAY(
    JSON '["a", "b"]', '$.x'
  ),
  -- NULL
  JSON_QUERY_ARRAY(JSON '"a"', '$'),`,
  },
  {
    ident: "JSON_TYPE",
    example: `SELECT
  -- 'boolean'
  JSON_TYPE(JSON 'true'),
  -- 'string'
  JSON_TYPE(JSON '"abc"'),
  -- 'number'
  JSON_TYPE(JSON '123'),
  -- 'null'
  JSON_TYPE(JSON 'null'),
  -- 'object'
  JSON_TYPE(JSON '{"key": "value"}'),
  -- 'array'
  JSON_TYPE(JSON '[1, 2, 3]'),`,
  },
  {
    ident: "JSON_VALUE",
    example: `SELECT
  JSON_VALUE(
    '{"x": "xxx"}', '$.x'
  ), -- 'xxx'
  JSON_VALUE(
    '{"x": "xxx"}', '$.y'
  ), -- NULL
  JSON_VALUE(
    '{"x": [1, 2]}', '$.x[0]'
  ), -- '1'
  JSON_VALUE(
    '{"x.y": [1, 2]}', '$."x.y"'
  ), -- NULL

  JSON_VALUE(
    JSON '"xxx"', '$'
  ), -- 'xxx'
  JSON_VALUE(
    JSON 'null', '$.x'
  ), -- NULL
  JSON_VALUE(
    JSON 'null', '$'
  ), -- NULL`,
  },
  {
    ident: "JSON_VALUE_ARRAY",
    example: `SELECT
  -- ['a', 'b']
  JSON_VALUE_ARRAY('["a", "b"]'),
  -- ['a', 'b']
  JSON_VALUE_ARRAY(
    '{"x": ["a", "b"]}', '$.x'
  ),
  -- NULL
  JSON_VALUE_ARRAY(
    '{"x": ["a", "b"]}', '$.y'
  ),
  -- ['a', 'b']
  JSON_VALUE_ARRAY(
    '{"x.y": ["a", "b"]}', '$."x.y"'
  ),

  -- ['a', 'b']
  JSON_VALUE_ARRAY(
    JSON '["a", "b"]', '$'
  ),
  -- NULL
  JSON_VALUE_ARRAY(
    JSON '["a", "b"]', '$.x'
  ),
  -- NULL
  JSON_VALUE_ARRAY(JSON '"a"', '$'),`,
  },
  {
    ident: "LAX_BOOL",
    example: `SELECT
  LAX_BOOL(JSON 'true'), -- true
  LAX_BOOL(JSON '"true"'), -- true
  LAX_BOOL(JSON '0'), -- false
  LAX_BOOL(JSON '1'), -- true
  LAX_BOOL(JSON '"string"'), -- null`,
  },
  {
    ident: "LAX_FLOAT64",
    example: `SELECT
  LAX_FLOAT64(JSON '0'), -- 0.0
  LAX_FLOAT64(JSON '"0"'), -- 0.0
  LAX_FLOAT64(JSON '1e3'), -- 1000.0
  LAX_FLOAT64(JSON '"string"'), -- null`,
  },
  {
    ident: "LAX_INT64",
    example: `SELECT
  LAX_INT64(JSON '0'), -- 0
  LAX_INT64(JSON '"0"'), -- 0
  LAX_INT64(JSON '0.5'), -- 1
  LAX_INT64(JSON '"string"'), -- null`,
  },
  {
    ident: "LAX_STRING",
    example: `SELECT
  LAX_STRING(JSON '"string"'), -- "string"
  LAX_STRING(JSON '0'), -- "0"
  LAX_STRING(JSON 'null'), -- null`,
  },
  {
    ident: "PARSE_JSON",
    example: `SELECT
  -- JSON '{"key": "value"}'
  PARSE_JSON('{"key": "value"}'),
  -- JSON '1.2345678901234567'
  PARSE_JSON(
    '1.23456789012345678',
    wide_number_mode => 'round'
  ),
  -- ERROR('...')
  PARSE_JSON('1.23456789012345678'),`,
  },
  // "STRING", // See timestamp function
  {
    ident: "TO_JSON",
    example: `SELECT
  -- JSON '{"one": 1}'
  TO_JSON(STRUCT(1 AS one)),
  -- JSON '12345678901234567'
  TO_JSON(12345678901234567),
  -- JSON '"12345678901234567"'
  TO_JSON(12345678901234567, stringify_wide_numbers => true),`,
  },
  {
    ident: "TO_JSON_STRING",
    example: `SELECT
  -- '[1,2]'
  TO_JSON_STRING([1, 2]),
  -- '{"x":1}'
  TO_JSON_STRING(STRUCT(1 AS x)),
  -- '{\\n  "x": 1\\n}'
  TO_JSON_STRING(STRUCT(1 AS x), true),`,
  },
  // ----- array functions -----
  {
    ident: "ARRAY",
    example: `SELECT
  -- [1, 2]
  ARRAY(
    SELECT x
    FROM UNNEST([1, 2]) AS x
  )`,
  },
  {
    ident: "ARRAY_CONCAT",
    example: `SELECT
  -- [1, 2, 3]
  ARRAY_CONCAT([1], [2, 3])`,
  },
  {
    ident: "ARRAY_LENGTH",
    example: `SELECT
  ARRAY_LENGTH([1, 2]) -- 2`,
  },
  {
    ident: "ARRAY_TO_STRING",
    example: `SELECT
  -- 'a,b'
  ARRAY_TO_STRING(
    ['a', 'b', NULL],
    ','
  ),
  -- 'abN!'
  ARRAY_TO_STRING(
    ['a', 'b', NULL],
    '',
    'N!'
  ),`,
  },
  {
    ident: "GENERATE_ARRAY",
    example: `SELECT
  -- [1, 2, 3, 4, 5]
  GENERATE_ARRAY(1, 5),
  -- [1, 3, 5]
  GENERATE_ARRAY(1, 5, 2),`,
  },
  {
    ident: "GENERATE_DATE_ARRAY",
    example: `SELECT
  -- ["2020-01-01", ..., "2020-01-31"]
  GENERATE_DATE_ARRAY(
    '2020-01-01',
    '2020-01-31'
  ),
  -- ["2020-01-01", "2020-01-31"]
  GENERATE_DATE_ARRAY(
    '2020-01-01',
    '2020-01-31',
    INTERVAL 30 DAY
  ),`,
  },
  {
    ident: "GENERATE_TIMESTAMP_ARRAY",
    example: `SELECT
  -- ["2020-01-01 00:00:00", ...]
  GENERATE_TIMESTAMP_ARRAY(
    '2020-01-01 00:00:00',
    '2020-01-02 00:00:00',
    INTERVAL 6 HOUR
  )`,
  },
  {
    ident: "ARRAY_REVERSE",
    example: `SELECT
  -- [3, 2, 1]
  ARRAY_REVERSE([1, 2, 3])`,
  },
  {
    ident: "OFFSET",
    example: `SELECT
  [1, 2, 3][OFFSET(0)] -- 1`,
  },
  {
    ident: "ORDINAL",
    example: `SELECT
  [1, 2, 3][ORDINAL(1)] -- 1`,
  },
  {
    ident: "SAFE_OFFSET",
    example: `SELECT
  [1, 2, 3][SAFE_OFFSET(0)], -- 1
  [1, 2, 3][SAFE_OFFSET(4)], -- NULL`,
  },
  {
    ident: "SAFE_ORDINAL",
    example: `SELECT
  [1, 2, 3][SAFE_ORDINAL(1)], -- 1
  [1, 2, 3][SAFE_ORDINAL(4)], -- NULL`,
  },
  // ----- date functions -----
  {
    ident: "CURRENT_DATE",
    example: `SELECT
  CURRENT_DATE() -- DATE '2021-01-01'`,
  },
  // "EXTRACT", // See timestamp function
  {
    ident: "DATE",
    example: `SELECT
  -- DATE '2020-01-01'
  DATE(2020, 1, 1),
  -- DATE '2020-01-01'
  DATE(TIMESTAMP '2020-01-01'),
  -- DATE '2019-12-31'
  DATE(
    TIMESTAMP '2020-01-01',
    'America/New_York'
  ),`,
  },
  {
    ident: "DATE_ADD",
    example: `SELECT
  -- DATE '2020-01-04'
  DATE_ADD('2020-01-01', INTERVAL 3 DAY)`,
  },
  {
    ident: "DATE_SUB",
    example: `SELECT
  -- DATE '2019-12-29'
  DATE_SUB('2020-01-01', INTERVAL 3 DAY)`,
  },
  {
    ident: "DATE_DIFF",
    example: `SELECT
  DATE_DIFF(
    '2020-01-01',
    '2019-12-30',
    DAY
  ), -- 2
  DATE_DIFF(
    '2020-01-01',
    '2019-12-30',
    YEAR
  ), -- 1`,
  },
  {
    ident: "DATE_TRUNC",
    example: `SELECT
  -- DATE '2020-01-01'
  DATE_TRUNC('2020-01-31', MONTH)`,
  },
  {
    ident: "DATE_FROM_UNIX_DATE",
    example: `SELECT
  DATE_FROM_UNIX_DATE(0) -- '1970-01-01'`,
  },
  {
    ident: "FORMAT_DATE",
    example: `SELECT
  -- '20200101'
  FORMAT_DATE('%Y%m%d', '2020-01-01'),
  -- '2020-01-01'
  FORMAT_DATE('%F', '2020-01-01'),`,
  },
  {
    ident: "LAST_DAY",
    example: `SELECT
  LAST_DAY(
    '2020-01-01'
  ), -- '2020-01-31'
  LAST_DAY(
    '2020-01-01',
    YEAR
  ), -- '2020-12-31'`,
  },
  {
    ident: "PARSE_DATE",
    example: `SELECT
  -- DATE '2020-01-01'
  PARSE_DATE('%Y%m%d', '20200101'),
  -- DATE '2020-01-01'
  parse_date('%F', '2020-01-01')`,
  },
  {
    ident: "UNIX_DATE",
    example: `SELECT
  UNIX_DATE(DATE '1969-12-31'), -- -1
  UNIX_DATE(DATE '1970-01-01'), --  0
  UNIX_DATE(DATE '1970-01-02'), --  1`,
  },
  // ----- datetime functions -----
  {
    ident: "CURRENT_DATETIME",
    example: `SELECT
  -- DATETIME '2020-01-01 00:00:00'
  CURRENT_DATETIME()`,
  },
  {
    ident: "DATETIME",
    example: `SELECT
  -- DATETIME '2020-01-01 23:59:59'
  DATETIME(2020, 1, 1, 23, 59, 59),
  -- DATETIME '2020-01-01 23:59:59'
  DATETIME(
    DATE '2020-01-01',
    TIME '23:59:59'
  ),
  -- DATETIME '2020-01-01 09:00:00'
  DATETIME(
    TIMESTAMP '2020-01-01 00:00:00 UTC',
    'Asia/Tokyo'
  ),`,
  },
  // "EXTRACT", // See timestamp function
  {
    ident: "DATETIME_ADD",
    example: `SELECT
  DATETIME_ADD(
    DATETIME '2020-01-01 00:00:00',
    INTERVAL 9 HOUR
  ) -- DATETIME '2020-01-01 09:00:00'`,
  },
  {
    ident: "DATETIME_SUB",
    example: `SELECT
  DATETIME_SUB(
    DATETIME '2020-01-01 00:00:00',
    INTERVAL 9 HOUR
  ) -- DATETIME '2019-12-31 15:00:00'`,
  },
  {
    ident: "DATETIME_DIFF",
    example: `SELECT
  DATETIME_DIFF(
    DATETIME '2020-01-01 00:00:00',
    DATETIME '2019-12-31 23:59:59',
    YEAR
  ) -- 1`,
  },
  {
    ident: "DATETIME_TRUNC",
    example: `SELECT
  DATETIME_TRUNC(
    DATETIME '2020-01-01 23:59:59',
    HOUR
  ) -- DATETIME '2020-01-01 23:00:00'`,
  },
  {
    ident: "FORMAT_DATETIME",
    example: `SELECT
  FORMAT_DATETIME(
    '%Y%m%d',
    DATETIME '2020-01-01'
  ), -- '20200101'
  FORMAT_DATETIME(
    '%F',
    DATETIME '2020-01-01'
  ), -- '2020-01-01'`,
  },
  // "LAST_DAY", // See date functions
  {
    ident: "PARSE_DATETIME",
    example: `SELECT
  PARSE_DATETIME(
    '%F %T',
    '2020-01-01 00:00:00'
  ) -- DATETIME '2020-01-01 00:00:00'`,
  },
  // ----- text analysis functions -----
  {
    ident: "BAG_OF_WORDS",
    example: `SELECT
  -- ARRAY<STRUCT<term string, count int64>>[
  --   ("gain", 1), ("no", 2), ("pain", 1)
  -- ]
  BAG_OF_WORDS([
    "no",
    "pain",
    "no",
    "gain"
  ])`,
  },
  {
    ident: "TEXT_ANALYZE",
    example: `SELECT
  -- ["no", "pain", "no", "gain"]
  TEXT_ANALYZE(["no pain, no gain"])`,
  },
  "TF_IDF",
  // ----- time functions -----
  {
    ident: "CURRENT_TIME",
    example: `SELECT
  -- TIME '09:49:52.047460'
  CURRENT_TIME()`,
  },
  {
    ident: "TIME",
    example: `SELECT
  -- TIME '09:00:00'
  TIME(9, 0, 0),
  -- TIME '09:00:00'
  TIME(TIMESTAMP '2020-01-01 09:00:00'),
  -- TIME '18:00:00'
  TIME(
    TIMESTAMP '2020-01-01 09:00:00 UTC',
    'Asia/Tokyo'
  ),
  -- TIME '09:00:00'
  TIME(DATETIME '2020-01-01 09:00:00'),`,
  },
  // "EXTRACT", // See timetamp function
  {
    ident: "TIME_ADD",
    example: `SELECT
  -- TIME '12:00:00'
  TIME_ADD('09:00:00', INTERVAL 3 HOUR),
  -- TIME '01:00:00'
  TIME_ADD('20:00:00', INTERVAL 5 HOUR),`,
  },
  {
    ident: "TIME_SUB",
    example: `SELECT
  -- TIME '02:00:00'
  TIME_SUB('05:00:00', INTERVAL 3 HOUR),
  -- TIME '23:00:00'
  TIME_SUB('05:00:00', INTERVAL 6 HOUR),`,
  },
  {
    ident: "TIME_DIFF",
    example: `SELECT
  TIME_DIFF(
    TIME '09:00:00',
    TIME '06:00:00',
    HOUR
  ), -- 3
  TIME_DIFF(
    TIME '09:00:00',
    TIME '08:59:59',
    MINUTE
  ), -- 1`,
  },
  {
    ident: "TIME_TRUNC",
    example: `SELECT
  -- TIME '00:00:00'
  TIME_TRUNC(TIME '00:00:59', MINUTE)`,
  },
  {
    ident: "FORMAT_TIME",
    example: `SELECT
  -- '23:59:59'
  FORMAT_TIME('%T', TIME '23:59:59')`,
  },
  {
    ident: "PARSE_TIME",
    example: `SELECT
  -- TIME '23:59:59'
  PARSE_TIME('%r', '11:59:59 PM')`,
  },
  // ----- timestamp functions -----
  {
    ident: "CURRENT_TIMESTAMP",
    example: `SELECT
  -- TIMESTAMP '2022-01-01 00-00-00 UTC'
  CURRENT_TIMESTAMP()`,
  },
  {
    ident: "EXTRACT",
    example: `SELECT
  -- 2020
  EXTRACT(
    YEAR
    FROM TIMESTAMP '2020-01-01'
  ),
  -- DATE '2019-12-31'
  EXTRACT(
    DATE FROM TIMESTAMP '2020-01-01'
    AT TIME ZONE 'America/New_York'
  ),
  -- TIME '00:00:00'
  EXTRACT(
    TIME
    FROM TIMESTAMP '2020-01-01'
  ),
  -- DATETIME '2020-01-01 09:00:00'
  EXTRACT(
    DATETIME FROM TIMESTAMP '2020-01-01'
    AT TIME ZONE 'Asia/Tokyo'
  ),`,
  },
  {
    ident: "STRING",
    example: `SELECT
  -- '2020-01-01 00:00:00+00'
  STRING(TIMESTAMP '2020-01-01'),
  -- '2020-01-01 09:00:00+09'
  STRING(
    TIMESTAMP '2020-01-01',
    'Asia/Tokyo'
  ),
  -- 'abc'
  STRING(JSON '"abc"'),`,
  },
  {
    ident: "TIMESTAMP",
    example: `SELECT
  -- TIMESTAMP '2020-01-01 00:00:00 UTC'
  TIMESTAMP('2020-01-01'),
  -- TIMESTAMP '2020-01-01 00:00:00 UTC'
  TIMESTAMP(DATE '2020-01-01'),
  -- TIMESTAMP '2020-01-01 00:00:00 UTC'
  TIMESTAMP(DATETIME '2020-01-01'),
  -- TIMESTAMP '2019-12-31 15:00:00 UTC'
  TIMESTAMP(
    DATETIME '2020-01-01',
    'Asia/Tokyo'
  ),`,
  },
  {
    ident: "TIMESTAMP_ADD",
    example: `SELECT
  -- TIMESTAMP '2020-01-01 09:00:00'
  TIMESTAMP_ADD(
    TIMESTAMP '2020-01-01 00:00:00',
    INTERVAL 9 HOUR
  )`,
  },
  {
    ident: "TIMESTAMP_SUB",
    example: `SELECT
  -- TIMESTAMP '2020-01-01 00:00:00'
  TIMESTAMP_SUB(
    TIMESTAMP '2020-01-01 09:00:00',
    INTERVAL 9 HOUR
  )`,
  },
  {
    ident: "TIMESTAMP_DIFF",
    example: `SELECT
  -- 9
  TIMESTAMP_DIFF(
    TIMESTAMP '2020-01-01 09:00:00',
    TIMESTAMP '2020-01-01 00:00:00',
    HOUR
  ),
  -- 1
  TIMESTAMP_DIFF(
    TIMESTAMP '2020-01-01 09:00:00',
    TIMESTAMP '2020-01-01 08:59:59',
    MINUTE
  ),`,
  },
  {
    ident: "TIMESTAMP_TRUNC",
    example: `SELECT
  -- TIMESTAMP '2020-01-01 00:00:00'
  TIMESTAMP_TRUNC(
    TIMESTAMP '2020-01-31 00:00:00',
    MONTH
  )`,
  },
  {
    ident: "FORMAT_TIMESTAMP",
    example: `SELECT
  -- Wed Jan  1 00:00:00 2020
  FORMAT_TIMESTAMP(
    '%c',
    TIMESTAMP '2020-01-01 00:00:00 UTC'
  ),
  -- Wed Jan  1 09:00:00 2020
  FORMAT_TIMESTAMP(
    '%c',
    TIMESTAMP '2020-01-01 00:00:00 UTC',
    'Asia/Tokyo'
  ),`,
  },
  {
    ident: "PARSE_TIMESTAMP",
    example: `SELECT
  -- TIMESTAMP '2020-01-01 00:00:00 UTC'
  PARSE_TIMESTAMP(
    '%Y-%m-%d %H:%M:%S',
    '2020-01-01 00:00:00'
  ),
  -- TIMESTAMP '2019-12-31 15:00:00 UTC'
  PARSE_TIMESTAMP(
    '%Y-%m-%d %H:%M:%S',
    '2020-01-01 00:00:00',
    'Asia/Tokyo'
  ),`,
  },
  {
    ident: "TIMESTAMP_SECONDS",
    example: `SELECT
  -- TIMESTAMP '1970-01-01 00:00:00 UTC'
  TIMESTAMP_SECONDS(0),
  -- TIMESTAMP '2022-01-01 00:00:01 UTC'
  TIMESTAMP_SECONDS(1640995200),`,
  },
  {
    ident: "TIMESTAMP_MILLIS",
    example: `SELECT
  -- TIMESTAMP '1970-01-01 00:00:00 UTC'
  TIMESTAMP_MILLIS(0),
  -- TIMESTAMP '2022-01-01 00:00:01 UTC'
  TIMESTAMP_MILLIS(1640995200000),`,
  },
  {
    ident: "TIMESTAMP_MICROS",
    example: `SELECT
  -- TIMESTAMP '1970-01-01 00:00:00 UTC'
  TIMESTAMP_MICROS(0),
  -- TIMESTAMP '2022-01-01 00:00:01 UTC'
  TIMESTAMP_MICROS(1640995200000000),`,
  },
  {
    ident: "UNIX_SECONDS",
    example: `SELECT
  -- 1640995200
  UNIX_SECONDS(TIMESTAMP '2022-01-01')`,
  },
  {
    ident: "UNIX_MILLIS",
    example: `SELECT
  -- 1640995200000
  UNIX_MILLIS(TIMESTAMP '2022-01-01')`,
  },
  {
    ident: "UNIX_MICROS",
    example: `SELECT
  -- 1640995200000000
  UNIX_MICROS(TIMESTAMP '2022-01-01')`,
  },
  // ----- interval functions -----
  {
    ident: "MAKE_INTERVAL",
    example: `SELECT
  -- INTERVAL 1 YEAR
  MAKE_INTERVAL(1),
  -- INTERVAL 1 YEAR + INTERVAL 1 SECOND
  MAKE_INTERVAL(1, 0, 0, 0, 0, 1),
  -- INTERVAL 1 YEAR + INTERVAL 1 DAY
  MAKE_INTERVAL(year => 1, day => 1),
  -- INTERVAL 1 YEAR + INTERVAL 1 DAY
  MAKE_INTERVAL(1, day => 1),`,
  },
  // "EXTRACT", // See timestamp function
  {
    ident: "JUSTIFY_DAYS",
    example: `SELECT
  -- INTERVAL '0-3 0' YEAR TO DAY
  JUSTIFY_DAYS(INTERVAL 90 DAY)`,
  },
  {
    ident: "JUSTIFY_HOURS",
    example: `SELECT
  -- INTERVAL '0-0 2' YEAR TO DAY
  JUSTIFY_HOURS(INTERVAL 48 HOUR)`,
  },
  {
    ident: "JUSTIFY_INTERVAL",
    example: `SELECT
  -- INTERVAL '0-1 3' YEAR TO DAY
  JUSTIFY_INTERVAL(
    INTERVAL '0-0 31 48:0:0'
    YEAR TO SECOND
  )`,
  },
  // ----- geography functions -----
  "S2_CELLIDFROMPOINT",
  "S2_COVERINGCELLIDS",
  "ST_ANGLE",
  "ST_AREA",
  "ST_ASBINARY",
  "ST_ASGEOJSON",
  "ST_ASTEXT",
  "ST_AZIMUTH",
  "ST_BOUNDARY",
  "ST_BOUNDINGBOX",
  "ST_BUFFER",
  "ST_BUFFERWITHTOLERANCE",
  "ST_CENTROID",
  "ST_CENTROID_AGG",
  "ST_CLOSESTPOINT",
  "ST_CLUSTERDBSCAN",
  "ST_CONTAINS",
  "ST_CONVEXHULL",
  "ST_COVEREDBY",
  "ST_COVERS",
  "ST_DIFFERENCE",
  "ST_DIMENSION",
  "ST_DISJOINT",
  "ST_DISTANCE",
  "ST_DUMP",
  "ST_DWITHIN",
  "ST_ENDPOINT",
  "ST_EXTENT",
  "ST_EQUALS",
  "ST_EXTERIORRING",
  "ST_GEOGFROM",
  "ST_GEOGFROMGEOJSON",
  "ST_GEOGFROMTEXT",
  "ST_GEOGFROMWKB",
  "ST_GEOGPOINT",
  "ST_GEOGPOINTFROMGEOHASH",
  "ST_GEOHASH",
  "ST_GEOMETRYTYPE",
  "ST_HAUSDORFFDISTANCE",
  "ST_INTERIORRINGS",
  "ST_INTERSECTION",
  "ST_INTERSECTS",
  "ST_INTERSECTSBOX",
  "ST_ISCLOSED",
  "ST_ISCOLLECTION",
  "ST_ISEMPTY",
  "ST_ISRING",
  "ST_LENGTH",
  "ST_LINESUBSTRING",
  "ST_LINEINTERPOLATEPOINT",
  "ST_MAKELINE",
  "ST_MAKEPOLYGON",
  "ST_MAKEPOLYGONORIENTED",
  "ST_MAXDISTANCE",
  "ST_NPOINTS",
  "ST_NUMGEOMETRIES",
  "ST_NUMPOINTS",
  "ST_PERIMETER",
  "ST_POINTN",
  "ST_SIMPLIFY",
  "ST_SNAPTOGRID",
  "ST_STARTPOINT",
  "ST_TOUCHES",
  "ST_UNION",
  "ST_UNION_AGG",
  "ST_WITHIN",
  "ST_X",
  "ST_Y",
  // ----- security functions -----
  {
    ident: "SESSION_USER",
    example: `SELECT
  SESSION_USER() -- 'abc@example.com'`,
  },
  // ----- uuid functions -----
  {
    ident: "GENERATE_UUID",
    example: `SELECT
    -- 'a9fd30f7-3f80-...'
    GENERATE_UUID()`,
  },
  // ----- conditional -----
  {
    ident: "COALESCE",
    example: `SELECT
  COALESCE('A', 'B'), -- 'A'
  COALESCE(NULL, 'A', 'B'), -- 'A'`,
  },
  {
    ident: "IF",
    example: `SELECT
  IF(true, 'A', 'B'), -- 'A'
  IF(false, 'A', 'B'), -- 'B'`,
  },
  {
    ident: "IFNULL",
    example: `SELECT
  IFNULL(NULL, 0), -- 0
  IFNULL(1, 0), -- 1`,
  },
  {
    ident: "NULLIF",
    example: `SELECT
  NULLIF(1, 1), -- NULL
  NULLIF(0, 1), -- 0`,
  },
  // ----- debugging functions -----
  { ident: "ERROR", example: `SELECT ERROR('error message!')` },
  // ----- federated query functions -----
  "EXTERNAL_QUERY",
];

export const notGlobalFunctions: { [key: string]: Func[] } = {
  KEYS: [
    // ----- AEAD encryption functions -----
    "NEW_KEYSET",
    "NEW_WRAPPED_KEYSET",
    "REWRAP_KEYSET",
    "ADD_KEY_FROM_RAW_BYTES",
    "KEYSET_CHAIN",
    "KEYSET_FROM_JSON",
    "KEYSET_TO_JSON",
    "ROTATE_KEYSET",
    "ROTATE_WRAPPED_KEYSET",
    "KEYSET_LENGTH",
  ],
  AEAD: [
    // ----- AEAD encryption functions -----
    "DECRYPT_BYTES",
    "DECRYPT_STRING",
    "ENCRYPT",
  ],
  HLL_COUNT: [
    // ----- HLL functions -----
    "INIT",
    "MERGE",
    "MERGE_PARTIAL",
    "EXTRACT",
  ],
  ML: [
    // ----- ML functions -----
    "TRANSFORM",
    "FEATURE_INFO",
    // general functions
    "IMPUTER",
    // numerical functions
    "BUCKETIZE",
    "MAX_ABS_SCALER",
    "MIN_MAX_SCALER",
    "NORMALIZER",
    "POLYNOMIAL_EXPAND",
    "QUANTILE_BUCKETIZE",
    "ROBUST_SCALER",
    "STANDARD_SCALER",
    // categorical functions
    "FEATURE_CROSS",
    "HASH_BUCKETIZE",
    "LABEL_ENCODER",
    "MULTI_HOT_ENCODER",
    "ONE_HOT_ENCODER",
    // text analysis functions
    "NGRAMS",
    "BAG_OF_WORDS",
    "TF_IDF",
    // image functions
    "CONVERT_COLOR_SPACE",
    "CONVERT_IMAGE_TYPE",
    "DECODE_IMAGE",
    "RESIZE_IMAGE",
    // point-in-time lookup functions
    "FEATURES_AT_TIME",
    "ENTITY_FEATURES_AT_TIME",
    // hyperparameter tuning functions
    "TRIAL_INFO",
    // evaluation functions
    "EVALUATE",
    "ROC_CURVE",
    "CONFUSION_MATRIX",
    "ARIMA_EVALUATE",
    "TRAINING_INFO",
    "RECONSTRUCTION_LOSS",
    "HOLIDAY_INFO",
    // inference functions
    "PREDICT",
    "FORECAST",
    "RECOMMEND",
    "DETECT_ANOMALIES",
    // generative ai functions
    "GENERATE_TEXT",
    "GENERATE_EMBEDDING",
    // ai functions
    "UNDERSTAND_TEXT",
    "TRANSLATE",
    "PROCESS_DOCUMENT",
    "TRANSCRIBE",
    "ANNOTATE_IMAGE",
    // ai explanation functions
    "ARIMA_COEFFICIENTS",
    "EXPLAIN_FORECAST",
    "GLOBAL_EXPLAIN",
    "FEATURE_IMPORTANCE",
    "ADVANCED_WEIGHTS",
    // model weights functions
    "WEIGHTS",
    "CENTROIDS",
    "PRINCIPAL_COMPONENTS",
    "PRINCIPAL_COMPONENT_INFO",
    "ARIMA_COEFFICIENTS",
    // math utility functions
    "DISTANCE",
    "LP_NORM",
  ],
  NET: [
    // ----- net functions -----
    {
      ident: "IP_FROM_STRING",
      example: `SELECT
  -- b'\\xc0\\x00\\x02\\x00'
  NET.IP_FROM_STRING('192.0.2.0'),
  -- b' \\x01\\x0d\\xb8\\x00\\x00\\x00\\x00...'
  NET.IP_FROM_STRING('2001:db8::0'),`,
    },
    {
      ident: "SAFE_IP_FROM_STRING",
      example: `SELECT
  -- b'\\xc0\\x00\\x02\\x00'
  NET.SAFE_IP_FROM_STRING('192.0.2.0'),
  -- b' \\x01\\x0d\\xb8\\x00\\x00\\x00\\x00...'
  NET.SAFE_IP_FROM_STRING('2001:db8::0'),
  -- NULL
  NET.SAFE_IP_FROM_STRING('invalid'),`,
    },
    {
      ident: "IP_TO_STRING",
      example: `SELECT
  -- '0.0.0.0'
  NET.IP_TO_STRING(b'\\x00\\x00\\x00\\x00')`,
    },
    {
      ident: "IP_NET_MASK",
      example: `SELECT
  -- b'\\xff\\x00\\x00\\x00'
  NET.IP_NET_MASK(4,8),
  -- b'\\xff\\x00\\x00\\x00\\x00...'
  NET.IP_NET_MASK(16,8),`,
    },
    {
      ident: "IP_TRUNC",
      example: `SELECT
  -- b'\\xc6\\x00\\x00\\x00'
  NET.IP_TRUNC(b'\\xc6\\x33\\x64\\xff', 8)`,
    },
    {
      ident: "IPV4_FROM_INT64",
      example: `SELECT
  -- b'\\x00\\x00\\x00\\x00'
  NET.IPV4_FROM_INT64(0),
  -- b'\\xc0\\x00\\x02\\x00'
  NET.IPV4_FROM_INT64(3221225984),`,
    },
    {
      ident: "IPV4_TO_INT64",
      example: `SELECT
  -- 0
  NET.IPV4_TO_INT64(b'\\x00\\x00\\x00\\x00'),
  -- 3221225984
  NET.IPV4_TO_INT64(b'\\xc0\\x00\\x02\\x00'),`,
    },
    {
      ident: "HOST",
      example: `SELECT
  NET.HOST(
    'https://cloud.google.com/'
  ), -- 'cloud.google.com'
  NET.PUBLIC_SUFFIX(
    'https://cloud.google.com/'
  ), -- 'com'
  NET.REG_DOMAIN(
    'https://cloud.google.com'
  ), -- 'google.com'`,
    },
    {
      ident: "PUBLIC_SUFFIX",
      example: `SELECT
  NET.HOST(
    'https://cloud.google.com/'
  ), -- 'cloud.google.com'
  NET.PUBLIC_SUFFIX(
    'https://cloud.google.com/'
  ), -- 'com'
  NET.REG_DOMAIN(
    'https://cloud.google.com'
  ), -- 'google.com'`,
    },
    {
      ident: "REG_DOMAIN",
      example: `SELECT
  NET.HOST(
    'https://cloud.google.com/'
  ), -- 'cloud.google.com'
  NET.PUBLIC_SUFFIX(
    'https://cloud.google.com/'
  ), -- 'com'
  NET.REG_DOMAIN(
    'https://cloud.google.com'
  ), -- 'google.com'`,
    },
  ],
};
