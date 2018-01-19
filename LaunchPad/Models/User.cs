using System.ComponentModel.DataAnnotations;

namespace LaunchPad.Models
{
    public enum UserType
    {
        Disabled,
        Launcher,
        Author,
        Administrator
    }

    public class User
    {
        public int Id { get; set; }
        [Required]
        public string Username { get; set; }
        public UserType Access { get; set; }
    }
}
