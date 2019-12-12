using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace LaunchPad.Models
{
    public class User
    {
        public int Id { get; set; }
        [Required]
        public string Username { get; set; }

        public IEnumerable<UserRole> UserRoles { get; set; }
        public IEnumerable<UserCategory> Categories { get; set; }
    }
}
