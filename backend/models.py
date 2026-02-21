from sqlalchemy import Column, Integer, String
from db import Base


class LinkedInUser(Base):
    __tablename__ = "linkedin_users"

    id = Column(Integer, primary_key=True, index=True)
    linkedin_id = Column(String)
    access_token = Column(String)


class TwitterUser(Base):
    __tablename__ = "twitter_users"

    id = Column(Integer, primary_key=True, index=True)
    twitter_id = Column(String, unique=True, index=True)
    access_token = Column(String)
    access_token_secret = Column(String)
    screen_name = Column(String)


class InstagramUser(Base):
    __tablename__ = "instagram_users"

    id = Column(Integer, primary_key=True, index=True)
    instagram_user_id = Column(String, unique=True, index=True)
    access_token = Column(String)
    username = Column(String)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
