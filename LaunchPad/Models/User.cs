namespace LaunchPad.Models
{
    public enum UserType
    {
        Disabled,
        Scheduler,
        Author,
        Administrator
    }

    public class User
    {
        public int Id { get; set; }
        public string Username { get; set; }
        public UserType Access { get; set; }
    }
}
