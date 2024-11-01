from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class User(Base):
    __tablename__ = 'user'
    id = Column(Integer, primary_key=True, autoincrement=True)
    geo_id = Column(String)
    geo_name = Column(String)
    discord_id = Column(String)
    user_daily_result = relationship('UserDailyResult', back_populates='user')
    

class Challenge(Base):
    __tablename__ = 'challenge'
    challenge_token = Column(String, primary_key=True)
    time = Column(String)
    user_daily_result = relationship('UserDailyResult', back_populates='challenge')
    

class UserDailyResult(Base):
    __tablename__ = 'user_daily_result'
    user_daily_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('user.id'))
    user = relationship('User', back_populates='user_daily_result')
    score = Column(Integer)
    challenge_token = Column(String, ForeignKey('challenge.challenge_token'))
    challenge = relationship('Challenge', back_populates='user_daily_result')
