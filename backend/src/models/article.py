from dataclasses import dataclass

@dataclass
class NewsArticle:
    url: str
    title: str
    content: str
    published_at: str
    source_name: str
    source_country: str
