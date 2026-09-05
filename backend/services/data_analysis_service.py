from pathlib import Path
from typing import Any

import matplotlib.pyplot as plt
import pandas as pd


# =========================================================
# SAFETY LIMITS
# =========================================================

MAX_FILE_SIZE_MB = 25
MAX_FILE_SIZE_BYTES = (
    MAX_FILE_SIZE_MB * 1024 * 1024
)

MAX_ROWS = 100_000


# =========================================================
# BASIC HELPERS
# =========================================================

def _clean_value(value: Any) -> Any:
    """
    Convert pandas/numpy values into JSON-safe Python values.
    """

    if pd.isna(value):
        return None

    if hasattr(value, "item"):
        try:
            return value.item()
        except Exception:
            pass

    return value


# =========================================================
# DATA LOADING
# =========================================================

def load_dataset(
    file_path: str,
) -> pd.DataFrame:
    """
    Load CSV or XLSX safely with file-size and row limits.
    """

    path = Path(file_path)

    # -----------------------------------------------------
    # File existence
    # -----------------------------------------------------

    if not path.exists():
        raise FileNotFoundError(
            "Data file not found."
        )

    if not path.is_file():
        raise ValueError(
            "Provided path is not a file."
        )

    # -----------------------------------------------------
    # File size validation
    # -----------------------------------------------------

    file_size = path.stat().st_size

    if file_size > MAX_FILE_SIZE_BYTES:
        raise ValueError(
            f"File is too large. Maximum allowed size is "
            f"{MAX_FILE_SIZE_MB} MB."
        )

    # -----------------------------------------------------
    # Extension validation
    # -----------------------------------------------------

    extension = path.suffix.lower()

    if extension not in {
        ".csv",
        ".xlsx",
    }:
        raise ValueError(
            "Only CSV and XLSX files are supported."
        )

    # -----------------------------------------------------
    # Read dataset
    # -----------------------------------------------------

    try:

        if extension == ".csv":
            df = pd.read_csv(path)

        else:
            df = pd.read_excel(path)

    except pd.errors.EmptyDataError:

        raise ValueError(
            "No columns to parse from file"
        )

    except pd.errors.ParserError as error:

        raise ValueError(
            f"Unable to parse CSV file: {str(error)}"
        )

    except Exception as error:

        raise ValueError(
            f"Unable to read dataset: {str(error)}"
        )

    # -----------------------------------------------------
    # Column validation
    # -----------------------------------------------------

    if len(df.columns) == 0:
        raise ValueError(
            "Dataset does not contain any columns."
        )

    # -----------------------------------------------------
    # Row limit validation
    # -----------------------------------------------------

    if len(df) > MAX_ROWS:
        raise ValueError(
            f"Dataset is too large. Maximum allowed rows "
            f"are {MAX_ROWS:,}."
        )

    return df


# =========================================================
# PROFILE
# =========================================================

def profile_dataset(
    file_path: str,
) -> dict:
    """
    Generate a complete profile of the uploaded dataset.
    """

    df = load_dataset(
        file_path
    )

    columns = []

    for column in df.columns:

        series = df[column]

        columns.append(
            {
                "name": str(column),
                "dtype": str(series.dtype),
                "missing": int(
                    series.isna().sum()
                ),
                "unique": int(
                    series.nunique(
                        dropna=True
                    )
                ),
            }
        )

    numeric_columns = (
        df.select_dtypes(
            include="number"
        ).columns.tolist()
    )

    statistics = {}

    if numeric_columns:

        numeric_description = (
            df[numeric_columns]
            .describe()
            .to_dict()
        )

        for column, values in (
            numeric_description.items()
        ):

            statistics[
                str(column)
            ] = {
                str(metric): _clean_value(
                    value
                )
                for metric, value in values.items()
            }

    missing_values = {
        str(column): int(
            df[column].isna().sum()
        )
        for column in df.columns
        if df[column].isna().sum() > 0
    }

    preview = [
        {
            str(column): _clean_value(
                value
            )
            for column, value in row.items()
        }
        for row in (
            df.head(10)
            .to_dict(
                orient="records"
            )
        )
    ]

    return {
        "file_name": Path(
            file_path
        ).name,
        "rows": int(
            df.shape[0]
        ),
        "columns": int(
            df.shape[1]
        ),
        "column_details": columns,
        "numeric_columns": [
            str(column)
            for column in numeric_columns
        ],
        "missing_values": missing_values,
        "statistics": statistics,
        "preview": preview,
    }


# =========================================================
# CORRELATION ANALYSIS
# =========================================================

def correlation_analysis(
    file_path: str,
) -> dict:
    """
    Calculate Pearson correlations between numeric columns.
    """

    df = load_dataset(
        file_path
    )

    numeric_df = df.select_dtypes(
        include="number"
    )

    if numeric_df.shape[1] < 2:
        return {
            "matrix": {},
            "relationships": [],
        }

    correlation_matrix = (
        numeric_df
        .corr()
        .round(3)
        .to_dict()
    )

    relationships = []

    columns = (
        numeric_df.columns.tolist()
    )

    for index, column_a in enumerate(
        columns
    ):

        for column_b in columns[
            index + 1:
        ]:

            value = (
                numeric_df[column_a]
                .corr(
                    numeric_df[column_b]
                )
            )

            if pd.isna(value):
                continue

            strength = abs(
                float(value)
            )

            if strength >= 0.7:
                level = "strong"

            elif strength >= 0.4:
                level = "moderate"

            elif strength >= 0.2:
                level = "weak"

            else:
                level = "very weak"

            direction = (
                "positive"
                if value > 0
                else "negative"
                if value < 0
                else "none"
            )

            relationships.append(
                {
                    "column_a": str(
                        column_a
                    ),
                    "column_b": str(
                        column_b
                    ),
                    "correlation": round(
                        float(value),
                        3,
                    ),
                    "strength": level,
                    "direction": direction,
                }
            )

    relationships.sort(
        key=lambda item: abs(
            item["correlation"]
        ),
        reverse=True,
    )

    matrix = {
        str(column): {
            str(other): _clean_value(
                value
            )
            for other, value in values.items()
        }
        for column, values in (
            correlation_matrix.items()
        )
    }

    return {
        "matrix": matrix,
        "relationships": relationships,
    }


# =========================================================
# OUTLIER ANALYSIS
# =========================================================

def outlier_analysis(
    file_path: str,
) -> dict:
    """
    Detect potential numeric outliers using the IQR method.
    """

    df = load_dataset(
        file_path
    )

    numeric_columns = (
        df.select_dtypes(
            include="number"
        ).columns
    )

    outliers = {}

    for column in numeric_columns:

        series = df[column].dropna()

        if series.empty:
            continue

        q1 = series.quantile(
            0.25
        )

        q3 = series.quantile(
            0.75
        )

        iqr = q3 - q1

        lower_bound = (
            q1 -
            1.5 * iqr
        )

        upper_bound = (
            q3 +
            1.5 * iqr
        )

        mask = (
            (series < lower_bound)
            |
            (series > upper_bound)
        )

        count = int(
            mask.sum()
        )

        outliers[
            str(column)
        ] = {
            "count": count,
            "percentage": round(
                (
                    count /
                    len(series)
                ) * 100,
                2,
            ),
            "lower_bound": round(
                float(
                    lower_bound
                ),
                3,
            ),
            "upper_bound": round(
                float(
                    upper_bound
                ),
                3,
            ),
        }

    return outliers


# =========================================================
# TREND ANALYSIS
# =========================================================

def trend_analysis(
    file_path: str,
) -> dict:
    """
    Provide simple first-to-last value changes
    for numeric columns.

    Note:
    This is row-order based, not true time-series analysis.
    """

    df = load_dataset(
        file_path
    )

    numeric_columns = (
        df.select_dtypes(
            include="number"
        ).columns
    )

    trends = {}

    for column in numeric_columns:

        series = df[column].dropna()

        if len(series) < 2:
            continue

        first_value = float(
            series.iloc[0]
        )

        last_value = float(
            series.iloc[-1]
        )

        change = (
            last_value -
            first_value
        )

        if change > 0:
            direction = "increasing"

        elif change < 0:
            direction = "decreasing"

        else:
            direction = "stable"

        mean_value = float(
            series.mean()
        )

        trends[
            str(column)
        ] = {
            "first_value": round(
                first_value,
                3,
            ),
            "last_value": round(
                last_value,
                3,
            ),
            "change": round(
                change,
                3,
            ),
            "direction": direction,
            "mean": round(
                mean_value,
                3,
            ),
        }

    return trends


# =========================================================
# INSIGHTS
# =========================================================

def generate_insights(
    file_path: str,
) -> list[str]:
    """
    Generate human-readable analytical insights.
    """

    df = load_dataset(
        file_path
    )

    insights = []

    numeric_df = df.select_dtypes(
        include="number"
    )

    # -----------------------------------------------------
    # No numeric columns
    # -----------------------------------------------------

    if numeric_df.empty:

        insights.append(
            "The dataset does not contain numeric columns."
        )

        return insights

    # -----------------------------------------------------
    # Strongest correlation
    # -----------------------------------------------------

    correlations = correlation_analysis(
        file_path
    )

    relationships = correlations.get(
        "relationships",
        [],
    )

    if relationships:

        strongest = relationships[0]

        insights.append(
            f"{strongest['column_a']} and "
            f"{strongest['column_b']} have the "
            f"strongest {strongest['strength']} "
            f"{strongest['direction']} correlation "
            f"({strongest['correlation']})."
        )

    # -----------------------------------------------------
    # Highest average
    # -----------------------------------------------------

    means = numeric_df.mean()

    if not means.empty:

        highest_mean_column = (
            means.idxmax()
        )

        insights.append(
            f"{highest_mean_column} has the highest "
            f"average value of "
            f"{float(means[highest_mean_column]):.2f}."
        )

    # -----------------------------------------------------
    # Lowest average
    # -----------------------------------------------------

    if not means.empty:

        lowest_mean_column = (
            means.idxmin()
        )

        if (
            lowest_mean_column
            != highest_mean_column
        ):

            insights.append(
                f"{lowest_mean_column} has the lowest "
                f"average value of "
                f"{float(means[lowest_mean_column]):.2f}."
            )

    # -----------------------------------------------------
    # Missing values
    # -----------------------------------------------------

    missing_count = int(
        df.isna()
        .sum()
        .sum()
    )

    if missing_count == 0:

        insights.append(
            "The dataset has no missing values."
        )

    else:

        insights.append(
            f"The dataset contains "
            f"{missing_count} missing values."
        )

    # -----------------------------------------------------
    # Outliers
    # -----------------------------------------------------

    outliers = outlier_analysis(
        file_path
    )

    outlier_columns = [
        column
        for column, data in outliers.items()
        if data["count"] > 0
    ]

    if outlier_columns:

        insights.append(
            "Potential outliers were detected in: "
            + ", ".join(
                outlier_columns
            )
            + "."
        )

    else:

        insights.append(
            "No potential numeric outliers were detected "
            "using the IQR method."
        )

    return insights


# =========================================================
# CHART GENERATION
# =========================================================

def generate_charts(
    file_path: str,
    output_dir: str | None = None,
) -> dict:
    """
    Generate useful charts for the dataset.

    Charts:
    - numeric distributions
    - strongest correlation scatter plot
    """

    df = load_dataset(
        file_path
    )

    numeric_df = df.select_dtypes(
        include="number"
    )

    if output_dir is None:

        output_path = (
            Path(file_path).parent
            /
            "charts"
        )

    else:

        output_path = Path(
            output_dir
        )

    output_path.mkdir(
        parents=True,
        exist_ok=True,
    )

    charts = []

    # -----------------------------------------------------
    # Numeric distribution charts
    # -----------------------------------------------------

    for column in numeric_df.columns:

        series = (
            numeric_df[column]
            .dropna()
        )

        if series.empty:
            continue

        safe_column_name = (
            str(column)
            .replace(
                " ",
                "_",
            )
            .replace(
                "/",
                "_",
            )
            .replace(
                "\\",
                "_",
            )
        )

        chart_path = (
            output_path
            /
            f"{safe_column_name}_distribution.png"
        )

        plt.figure(
            figsize=(8, 5)
        )

        plt.hist(
            series,
            bins=10,
            edgecolor="black",
        )

        plt.title(
            f"{column} Distribution"
        )

        plt.xlabel(
            str(column)
        )

        plt.ylabel(
            "Frequency"
        )

        plt.tight_layout()

        plt.savefig(
            chart_path,
            dpi=150,
        )

        plt.close()

        charts.append(
            {
                "type": "distribution",
                "column": str(
                    column
                ),
                "path": str(
                    chart_path
                ),
                "filename": (
                    chart_path.name
                ),
            }
        )

    # -----------------------------------------------------
    # Strongest correlation chart
    # -----------------------------------------------------

    correlations = correlation_analysis(
        file_path
    )

    relationships = correlations.get(
        "relationships",
        [],
    )

    if relationships:

        strongest = relationships[0]

        column_a = strongest[
            "column_a"
        ]

        column_b = strongest[
            "column_b"
        ]

        chart_path = (
            output_path
            /
            "strongest_correlation.png"
        )

        plt.figure(
            figsize=(8, 5)
        )

        plt.scatter(
            df[column_a],
            df[column_b],
            alpha=0.7,
        )

        plt.title(
            f"{column_a} vs {column_b}"
        )

        plt.xlabel(
            column_a
        )

        plt.ylabel(
            column_b
        )

        plt.tight_layout()

        plt.savefig(
            chart_path,
            dpi=150,
        )

        plt.close()

        charts.append(
            {
                "type": "correlation",
                "column_a": column_a,
                "column_b": column_b,
                "correlation": strongest[
                    "correlation"
                ],
                "path": str(
                    chart_path
                ),
                "filename": (
                    chart_path.name
                ),
            }
        )

    return {
        "output_directory": str(
            output_path
        ),
        "charts": charts,
    }


# =========================================================
# DOWNLOADABLE REPORT
# =========================================================

def generate_analysis_report(
    file_path: str,
    output_dir: str | None = None,
) -> str:
    """
    Generate a human-readable downloadable TXT report.
    """

    profile = profile_dataset(
        file_path
    )

    correlations = correlation_analysis(
        file_path
    )

    outliers = outlier_analysis(
        file_path
    )

    trends = trend_analysis(
        file_path
    )

    insights = generate_insights(
        file_path
    )

    if output_dir is None:

        report_dir = (
            Path(file_path).parent
            /
            "reports"
        )

    else:

        report_dir = Path(
            output_dir
        )

    report_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    source_name = Path(
        file_path
    ).stem

    report_path = (
        report_dir
        /
        f"{source_name}_analysis_report.txt"
    )

    lines = []

    lines.append(
        "=" * 70
    )

    lines.append(
        "NOVA AI WORKSPACE - DATA ANALYSIS REPORT"
    )

    lines.append(
        "=" * 70
    )

    lines.append("")

    lines.append(
        f"Dataset: {profile['file_name']}"
    )

    lines.append(
        f"Rows: {profile['rows']}"
    )

    lines.append(
        f"Columns: {profile['columns']}"
    )

    lines.append(
        f"Numeric Columns: "
        f"{len(profile['numeric_columns'])}"
    )

    lines.append("")

    # -----------------------------------------------------
    # Column profile
    # -----------------------------------------------------

    lines.append(
        "COLUMN PROFILE"
    )

    lines.append(
        "-" * 70
    )

    for column in profile[
        "column_details"
    ]:

        lines.append(
            (
                f"{column['name']} | "
                f"type={column['dtype']} | "
                f"missing={column['missing']} | "
                f"unique={column['unique']}"
            )
        )

    lines.append("")

    # -----------------------------------------------------
    # Numeric statistics
    # -----------------------------------------------------

    lines.append(
        "NUMERIC STATISTICS"
    )

    lines.append(
        "-" * 70
    )

    if profile[
        "statistics"
    ]:

        for column, stats in (
            profile[
                "statistics"
            ].items()
        ):

            lines.append(
                f"{column}:"
            )

            for metric in [
                "count",
                "mean",
                "std",
                "min",
                "25%",
                "50%",
                "75%",
                "max",
            ]:

                lines.append(
                    f"  {metric}: "
                    f"{stats.get(metric, '-')}"
                )

            lines.append("")

    else:

        lines.append(
            "No numeric statistics available."
        )

        lines.append("")

    # -----------------------------------------------------
    # Insights
    # -----------------------------------------------------

    lines.append(
        "KEY INSIGHTS"
    )

    lines.append(
        "-" * 70
    )

    if insights:

        for index, insight in enumerate(
            insights,
            start=1,
        ):

            lines.append(
                f"{index}. {insight}"
            )

    else:

        lines.append(
            "No insights available."
        )

    lines.append("")

    # -----------------------------------------------------
    # Correlations
    # -----------------------------------------------------

    lines.append(
        "CORRELATIONS"
    )

    lines.append(
        "-" * 70
    )

    relationships = correlations.get(
        "relationships",
        [],
    )

    if relationships:

        for relationship in relationships:

            lines.append(
                (
                    f"{relationship['column_a']} ↔ "
                    f"{relationship['column_b']} | "
                    f"correlation="
                    f"{relationship['correlation']} | "
                    f"{relationship['strength']} "
                    f"{relationship['direction']}"
                )
            )

    else:

        lines.append(
            "No correlation data available."
        )

    lines.append("")

    # -----------------------------------------------------
    # Outliers
    # -----------------------------------------------------

    lines.append(
        "OUTLIER ANALYSIS"
    )

    lines.append(
        "-" * 70
    )

    if outliers:

        for column, data in outliers.items():

            lines.append(
                (
                    f"{column} | "
                    f"outliers={data['count']} | "
                    f"percentage={data['percentage']}% | "
                    f"lower={data['lower_bound']} | "
                    f"upper={data['upper_bound']}"
                )
            )

    else:

        lines.append(
            "No outlier data available."
        )

    lines.append("")

    # -----------------------------------------------------
    # Trends
    # -----------------------------------------------------

    lines.append(
        "TREND ANALYSIS"
    )

    lines.append(
        "-" * 70
    )

    if trends:

        for column, trend in trends.items():

            lines.append(
                (
                    f"{column} | "
                    f"direction={trend['direction']} | "
                    f"first={trend['first_value']} | "
                    f"last={trend['last_value']} | "
                    f"change={trend['change']} | "
                    f"mean={trend['mean']}"
                )
            )

    else:

        lines.append(
            "No trend data available."
        )

    lines.append("")

    lines.append(
        "=" * 70
    )

    lines.append(
        "Generated by Nova AI Workspace"
    )

    lines.append(
        "=" * 70
    )

    report_path.write_text(
        "\n".join(lines),
        encoding="utf-8",
    )

    return str(
        report_path
    )


# =========================================================
# COMPLETE ANALYSIS
# =========================================================

def analyze_dataset(
    file_path: str,
) -> dict:
    """
    Run the complete dataset analysis pipeline.
    """

    profile = profile_dataset(
        file_path
    )

    correlations = correlation_analysis(
        file_path
    )

    outliers = outlier_analysis(
        file_path
    )

    trends = trend_analysis(
        file_path
    )

    insights = generate_insights(
        file_path
    )

    charts = generate_charts(
        file_path
    )

    return {
        "profile": profile,
        "correlations": correlations,
        "outliers": outliers,
        "trends": trends,
        "insights": insights,
        "charts": charts,
    }