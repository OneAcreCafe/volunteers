class User < ActiveRecord::Base
  # Include default devise modules. Others available are:
  # :lockable, :timeoutable and :omniauthable
  devise :database_authenticatable, :registerable, :omniauthable,
         :recoverable, :rememberable, :trackable, :validatable

  has_and_belongs_to_many :shifts, -> { uniq }
  has_and_belongs_to_many :roles, -> { uniq }

  def role?(role)
    roles.collect(&:name).map(&:downcase).include? role.to_s
  end

  def display_name
    name = self.nickname || self.given_name || self.email || 'Nameless'
  end

  def full_name
    name = self.given_name if self.given_name and not self.given_name.try(:empty?)
    name += ' ' if name and not self.family_name.try(:empty?)
    name = (name || '') + self.family_name if self.family_name and not self.family_name.try(:empty?)
    name ||= self.nickname || self.email || 'Nameless'
  end
  
  def self.from_omniauth(auth)
    where(auth.slice(:provider, :uid)).first_or_create do |user|
      user.provider = auth.provider
      user.uid = auth.uid
      user.email = auth.info.email
      user.given_name = auth.info.first_name
      user.family_name = auth.info.last_name
      user.nickname = auth.info.nickname
    end
  end

  def self.new_with_session(params, session)
    if session["devise.user_attributes"]
      new session["devise.user_attributes"] do |user|
        user.attributes = params
        user.valid?
      end
    else
      super
    end
  end
  
  def email_required?
    false
  end

  def password_required?
    # super && provider.blank?
    false
  end
  
  def update_with_password(params, *options)
    if encrypted_password.blank?
      update_attributes(params, *options)
    else
      super
    end
  end
end
